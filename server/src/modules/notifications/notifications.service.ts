import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Recent notifications for the user plus global (userId = null) ones. */
  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const res = await this.prisma.notification.updateMany({
      where: { OR: [{ userId }, { userId: null }], readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }
}
