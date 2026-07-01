import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JoinRequestStatus, LiveClassMode, LiveClassStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { HmsService } from './hms.service';
import type { AuthInstructor } from './instructor/instructor-auth.guard';
import type { AuthParticipant } from './participant/participant-auth.guard';

const slugify = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'class';

@Injectable()
export class LiveClassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hms: HmsService,
  ) {}

  // ---- Host (instructor) ----

  async create(host: AuthInstructor, input: { title: string; description?: string; mode?: LiveClassMode; requireApproval?: boolean; scheduledAt?: string }) {
    const title = input.title.trim();
    if (title.length < 2) throw new BadRequestException('Class needs a title.');
    const slug = await this.uniqueSlug(slugify(title));
    return this.prisma.liveClass.create({
      data: {
        title,
        slug,
        description: input.description?.trim() || null,
        mode: input.mode ?? LiveClassMode.WEBINAR,
        requireApproval: input.requireApproval ?? false,
        hostId: host.id,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      },
    });
  }

  listForHost(host: AuthInstructor) {
    return this.prisma.liveClass.findMany({ where: { hostId: host.id }, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 100 });
  }

  /** Start a class: create the 100ms room (if video configured) and mark it LIVE. */
  async start(id: string, host: AuthInstructor) {
    const cls = await this.ownedOrThrow(id, host);
    let hmsRoomId = cls.hmsRoomId;
    if (!hmsRoomId && this.hms.isConfigured()) {
      hmsRoomId = await this.hms.createRoom(cls.slug);
    }
    const updated = await this.prisma.liveClass.update({
      where: { id },
      data: { status: LiveClassStatus.LIVE, startedAt: cls.startedAt ?? new Date(), hmsRoomId },
    });
    await this.log(id, 'STARTED', host.name);
    return updated;
  }

  async end(id: string, host: AuthInstructor) {
    await this.ownedOrThrow(id, host);
    const updated = await this.prisma.liveClass.update({
      where: { id },
      data: { status: LiveClassStatus.ENDED, endedAt: new Date() },
    });
    await this.log(id, 'ENDED', host.name);
    return updated;
  }

  /** A host's own token to join the live room with the 'host' role. */
  async hostToken(id: string, host: AuthInstructor) {
    const cls = await this.ownedOrThrow(id, host);
    if (cls.status !== LiveClassStatus.LIVE) throw new BadRequestException('Start the class first.');
    const video = this.hms.isConfigured() && !!cls.hmsRoomId;
    return {
      classId: cls.id,
      title: cls.title,
      mode: cls.mode,
      requireApproval: cls.requireApproval,
      role: 'host' as const,
      videoEnabled: video,
      roomId: cls.hmsRoomId,
      token: video ? await this.hms.authToken(cls.hmsRoomId as string, `host-${host.id}`, 'host') : null,
      roles: this.hms.roles(),
    };
  }

  /** Lightweight status check — lets a room poll for "the host ended this". */
  async status(id: string): Promise<{ status: LiveClassStatus }> {
    const cls = await this.prisma.liveClass.findUnique({ where: { id }, select: { status: true } });
    if (!cls) throw new NotFoundException('Class not found.');
    return { status: cls.status };
  }

  // ---- Participant (public) ----

  /** Classes a learner can see: live now, or scheduled/upcoming. */
  listJoinable() {
    return this.prisma.liveClass.findMany({
      where: { status: { in: [LiveClassStatus.LIVE, LiveClassStatus.SCHEDULED] } },
      orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }, { createdAt: 'desc' }],
      take: 100,
      select: { id: true, title: true, slug: true, description: true, status: true, mode: true, scheduledAt: true, startedAt: true },
    });
  }

  /** Join a live class → returns a 100ms guest token (or videoEnabled:false if
   *  not configured). Approval-gated classes return {waiting:true,…} until the
   *  host admits the student — the client polls this endpoint while waiting. */
  async joinAsParticipant(slug: string, p: AuthParticipant) {
    const cls = await this.prisma.liveClass.findUnique({ where: { slug } });
    if (!cls) throw new NotFoundException('Class not found.');
    if (cls.status !== LiveClassStatus.LIVE) throw new BadRequestException('This class is not live right now.');

    if (cls.requireApproval) {
      let req = await this.prisma.classJoinRequest.findUnique({
        where: { classId_participantId: { classId: cls.id, participantId: p.id } },
      });
      if (!req) {
        req = await this.prisma.classJoinRequest.create({ data: { classId: cls.id, participantId: p.id } });
        await this.log(cls.id, 'JOIN_REQUESTED', p.name);
      }
      if (req.status !== JoinRequestStatus.APPROVED) {
        return { waiting: true as const, status: req.status, classId: cls.id, title: cls.title };
      }
    }

    const video = this.hms.isConfigured() && !!cls.hmsRoomId;
    // Meeting mode → students join able to publish; Webinar → view-only.
    const kind = cls.mode === LiveClassMode.MEETING ? 'stage' : 'guest';
    await this.log(cls.id, 'JOINED', p.name);
    return {
      classId: cls.id,
      title: cls.title,
      mode: cls.mode,
      role: 'guest' as const,
      videoEnabled: video,
      roomId: cls.hmsRoomId,
      token: video ? await this.hms.authToken(cls.hmsRoomId as string, `guest-${p.id}`, kind) : null,
      roles: this.hms.roles(),
    };
  }

  // ---- Waiting room (host decides who gets in) ----

  /** Pending join requests for an approval-gated class (host only). */
  async listJoinRequests(classId: string, host: AuthInstructor) {
    await this.ownedOrThrow(classId, host);
    const rows = await this.prisma.classJoinRequest.findMany({
      where: { classId, status: JoinRequestStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: { participant: { select: { name: true } } },
    });
    return rows.map((r) => ({ id: r.id, name: r.participant.name, requestedAt: r.createdAt.toISOString() }));
  }

  /** Approve or deny a waiting student. */
  async decideJoinRequest(classId: string, requestId: string, host: AuthInstructor, approve: boolean) {
    await this.ownedOrThrow(classId, host);
    const req = await this.prisma.classJoinRequest.findUnique({
      where: { id: requestId },
      include: { participant: { select: { name: true } } },
    });
    if (!req || req.classId !== classId) throw new NotFoundException('Join request not found.');
    await this.prisma.classJoinRequest.update({
      where: { id: requestId },
      data: { status: approve ? JoinRequestStatus.APPROVED : JoinRequestStatus.DENIED, decidedAt: new Date() },
    });
    await this.log(classId, approve ? 'JOIN_APPROVED' : 'JOIN_DENIED', host.name, req.participant.name);
    return { ok: true as const };
  }

  // ---- Activity log (debugging/audit; host only) ----

  async activity(classId: string, host: AuthInstructor) {
    await this.ownedOrThrow(classId, host);
    return this.prisma.classActivity.findMany({
      where: { classId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, type: true, actorName: true, detail: true, createdAt: true },
    });
  }

  /** Best-effort activity write — never breaks the main flow. */
  private async log(classId: string, type: string, actorName: string, detail?: string) {
    await this.prisma.classActivity
      .create({ data: { classId, type, actorName, detail: detail ?? null } })
      .catch(() => undefined);
  }

  // ---- helpers ----

  private async ownedOrThrow(id: string, host: AuthInstructor) {
    const cls = await this.prisma.liveClass.findUnique({ where: { id } });
    if (!cls) throw new NotFoundException('Class not found.');
    if (cls.hostId !== host.id) {
      throw new ForbiddenException('This class belongs to another host.');
    }
    return cls;
  }

  private async uniqueSlug(base: string): Promise<string> {
    let slug = base;
    for (let i = 2; await this.prisma.liveClass.findUnique({ where: { slug } }); i++) {
      slug = `${base}-${i}`;
    }
    return slug;
  }
}
