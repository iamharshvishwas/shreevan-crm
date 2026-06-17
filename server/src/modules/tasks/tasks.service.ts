import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundError } from '../../common/errors/domain.errors';

export type TaskBucket = 'overdue' | 'today' | 'upcoming' | 'done';

/** IST calendar date (YYYY-MM-DD) — string-comparable for day bucketing. */
const istDate = (d: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  /** All tasks with a computed bucket; the frontend tabs filter + count from this. */
  async list(ownerId?: string) {
    const tasks = await this.prisma.task.findMany({
      where: ownerId && ownerId !== 'all' ? { ownerId } : {},
      include: {
        lead: { select: { id: true, contact: { select: { name: true } } } },
        contact: { select: { name: true } },
        enquiry: { select: { id: true, contact: { select: { name: true } } } },
      },
      orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
    });
    const today = istDate(new Date());
    return tasks.map((t) => {
      let bucket: TaskBucket;
      if (t.status === TaskStatus.DONE) bucket = 'done';
      else if (!t.dueAt) bucket = 'upcoming';
      else {
        const d = istDate(t.dueAt);
        bucket = d < today ? 'overdue' : d === today ? 'today' : 'upcoming';
      }
      const relatedName = t.lead?.contact.name ?? t.contact?.name ?? t.enquiry?.contact.name ?? null;
      return { ...t, bucket, relatedName };
    });
  }

  create(input: { title: string; type?: string; priority?: 'HIGH' | 'NORMAL' | 'LOW'; dueAt?: string; ownerId?: string; leadId?: string; contactId?: string }) {
    return this.prisma.task.create({
      data: {
        title: input.title,
        type: input.type ?? 'Follow-up',
        priority: input.priority ?? 'NORMAL',
        dueAt: input.dueAt ? new Date(input.dueAt) : undefined,
        ownerId: input.ownerId,
        leadId: input.leadId,
        contactId: input.contactId,
      },
    });
  }

  async setDone(id: string, done: boolean) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundError('Task', id);
    return this.prisma.task.update({
      where: { id },
      data: { status: done ? TaskStatus.DONE : TaskStatus.OPEN, completedAt: done ? new Date() : null },
    });
  }
}
