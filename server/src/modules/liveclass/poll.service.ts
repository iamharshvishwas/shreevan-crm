import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type { AuthInstructor } from './instructor/instructor-auth.guard';

export interface PollView {
  id: string;
  question: string;
  isOpen: boolean;
  totalVotes: number;
  options: { id: string; text: string; votes: number }[];
  myOptionId: string | null;
}

@Injectable()
export class PollService {
  constructor(private readonly prisma: PrismaService) {}

  /** Most recent poll for a class (open or just-closed), with live counts.
   *  `viewerParticipantId` (if a learner) marks which option they picked. */
  async current(classId: string, viewerParticipantId?: string): Promise<PollView | null> {
    const poll = await this.prisma.poll.findFirst({
      where: { classId },
      orderBy: { createdAt: 'desc' },
      include: { options: { orderBy: { order: 'asc' } } },
    });
    if (!poll) return null;

    const counts = await this.prisma.pollVote.groupBy({
      by: ['optionId'],
      where: { pollId: poll.id },
      _count: { optionId: true },
    });
    const countMap = new Map(counts.map((c) => [c.optionId, c._count.optionId]));

    let myOptionId: string | null = null;
    if (viewerParticipantId) {
      const mine = await this.prisma.pollVote.findUnique({
        where: { pollId_participantId: { pollId: poll.id, participantId: viewerParticipantId } },
        select: { optionId: true },
      });
      myOptionId = mine?.optionId ?? null;
    }

    const options = poll.options.map((o) => ({ id: o.id, text: o.text, votes: countMap.get(o.id) ?? 0 }));
    return {
      id: poll.id,
      question: poll.question,
      isOpen: poll.isOpen,
      totalVotes: options.reduce((s, o) => s + o.votes, 0),
      options,
      myOptionId,
    };
  }

  /** Host launches a poll — closes any existing open poll for the class first. */
  async create(classId: string, host: AuthInstructor, question: string, optionTexts: string[]): Promise<PollView> {
    await this.ownedOrThrow(classId, host);
    const q = (question ?? '').trim();
    const opts = (optionTexts ?? []).map((t) => (t ?? '').trim()).filter(Boolean);
    if (q.length < 2) throw new BadRequestException('Poll needs a question.');
    if (opts.length < 2) throw new BadRequestException('Add at least two options.');
    if (opts.length > 6) throw new BadRequestException('At most six options.');

    await this.prisma.poll.updateMany({ where: { classId, isOpen: true }, data: { isOpen: false, closedAt: new Date() } });
    const poll = await this.prisma.poll.create({
      data: { classId, question: q, options: { create: opts.map((text, i) => ({ text: text.slice(0, 120), order: i })) } },
    });
    return (await this.current(classId))!;
  }

  async close(classId: string, host: AuthInstructor): Promise<PollView | null> {
    await this.ownedOrThrow(classId, host);
    await this.prisma.poll.updateMany({ where: { classId, isOpen: true }, data: { isOpen: false, closedAt: new Date() } });
    return this.current(classId);
  }

  /** Learner casts/changes a vote on the open poll (one vote per participant). */
  async vote(classId: string, participantId: string, optionId: string): Promise<PollView> {
    const poll = await this.prisma.poll.findFirst({
      where: { classId, isOpen: true },
      orderBy: { createdAt: 'desc' },
      include: { options: { select: { id: true } } },
    });
    if (!poll) throw new BadRequestException('No open poll right now.');
    if (!poll.options.some((o) => o.id === optionId)) throw new BadRequestException('That option is not part of the poll.');
    await this.prisma.pollVote.upsert({
      where: { pollId_participantId: { pollId: poll.id, participantId } },
      create: { pollId: poll.id, optionId, participantId },
      update: { optionId },
    });
    return (await this.current(classId, participantId))!;
  }

  private async ownedOrThrow(classId: string, host: AuthInstructor) {
    const cls = await this.prisma.liveClass.findUnique({ where: { id: classId }, select: { hostId: true } });
    if (!cls) throw new NotFoundException('Class not found.');
    if (cls.hostId !== host.id) throw new ForbiddenException('This class belongs to another host.');
  }
}
