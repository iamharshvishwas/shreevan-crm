import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LiveClassStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { ClassMember } from './class-member.guard';

export interface ChatMessageView {
  id: string;
  authorName: string;
  isHost: boolean;
  body: string;
  createdAt: string;
}

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  /** Last 100 messages for a class, oldest→newest (client replaces its list). */
  async list(classId: string): Promise<ChatMessageView[]> {
    await this.classOrThrow(classId);
    const rows = await this.prisma.classMessage.findMany({
      where: { classId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, authorName: true, isHost: true, body: true, createdAt: true },
    });
    return rows.reverse().map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }));
  }

  async post(classId: string, member: ClassMember, body: string): Promise<ChatMessageView> {
    const cls = await this.classOrThrow(classId);
    if (cls.status !== LiveClassStatus.LIVE) throw new BadRequestException('This class is not live.');
    const text = (body ?? '').trim();
    if (!text) throw new BadRequestException('Message is empty.');
    const m = await this.prisma.classMessage.create({
      data: {
        classId,
        participantId: member.kind === 'participant' ? member.id : null,
        authorName: member.name,
        isHost: member.kind === 'host',
        body: text.slice(0, 1000),
      },
      select: { id: true, authorName: true, isHost: true, body: true, createdAt: true },
    });
    return { ...m, createdAt: m.createdAt.toISOString() };
  }

  private async classOrThrow(classId: string) {
    const cls = await this.prisma.liveClass.findUnique({ where: { id: classId }, select: { id: true, status: true } });
    if (!cls) throw new NotFoundException('Class not found.');
    return cls;
  }
}
