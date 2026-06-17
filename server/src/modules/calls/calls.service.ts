import { Injectable } from '@nestjs/common';
import { CallStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundError } from '../../common/errors/domain.errors';

@Injectable()
export class CallsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const calls = await this.prisma.discoveryCall.findMany({
      include: {
        contact: { select: { name: true, country: true, timezone: true } },
        owner: { select: { name: true } },
        lead: { select: { id: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    const now = Date.now();
    const upcoming = calls.filter((c) => c.status === CallStatus.SCHEDULED && new Date(c.scheduledAt).getTime() >= now);
    const completed = calls.filter((c) => c.status === CallStatus.COMPLETED);
    return { upcoming, completed };
  }

  async complete(id: string, outcome?: string) {
    await this.ensure(id);
    return this.prisma.discoveryCall.update({ where: { id }, data: { status: CallStatus.COMPLETED, outcome } });
  }

  async reschedule(id: string, scheduledAt: string) {
    await this.ensure(id);
    return this.prisma.discoveryCall.update({ where: { id }, data: { scheduledAt: new Date(scheduledAt), status: CallStatus.SCHEDULED } });
  }

  async cancel(id: string) {
    await this.ensure(id);
    return this.prisma.discoveryCall.update({ where: { id }, data: { status: CallStatus.CANCELLED } });
  }

  private async ensure(id: string) {
    if (!(await this.prisma.discoveryCall.count({ where: { id } }))) throw new NotFoundError('Discovery call', id);
  }
}
