import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LiveClassMode, LiveClassStatus } from '@prisma/client';
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

  async create(host: AuthInstructor, input: { title: string; description?: string; mode?: LiveClassMode; scheduledAt?: string }) {
    const title = input.title.trim();
    if (title.length < 2) throw new BadRequestException('Class needs a title.');
    const slug = await this.uniqueSlug(slugify(title));
    return this.prisma.liveClass.create({
      data: {
        title,
        slug,
        description: input.description?.trim() || null,
        mode: input.mode ?? LiveClassMode.WEBINAR,
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
    return this.prisma.liveClass.update({
      where: { id },
      data: { status: LiveClassStatus.LIVE, startedAt: cls.startedAt ?? new Date(), hmsRoomId },
    });
  }

  async end(id: string, host: AuthInstructor) {
    await this.ownedOrThrow(id, host);
    return this.prisma.liveClass.update({
      where: { id },
      data: { status: LiveClassStatus.ENDED, endedAt: new Date() },
    });
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
      role: 'host' as const,
      videoEnabled: video,
      roomId: cls.hmsRoomId,
      token: video ? await this.hms.authToken(cls.hmsRoomId as string, `host-${host.id}`, 'host') : null,
      roles: this.hms.roles(),
    };
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

  /** Join a live class → returns a 100ms guest token (or videoEnabled:false if not configured). */
  async joinAsParticipant(slug: string, p: AuthParticipant) {
    const cls = await this.prisma.liveClass.findUnique({ where: { slug } });
    if (!cls) throw new NotFoundException('Class not found.');
    if (cls.status !== LiveClassStatus.LIVE) throw new BadRequestException('This class is not live right now.');
    const video = this.hms.isConfigured() && !!cls.hmsRoomId;
    // Meeting mode → students join able to publish; Webinar → view-only.
    const kind = cls.mode === LiveClassMode.MEETING ? 'stage' : 'guest';
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
