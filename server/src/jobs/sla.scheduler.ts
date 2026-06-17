import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EnquiryStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { computeSla } from '../modules/enquiries/sla.util';

/**
 * Evaluates first-response SLAs and raises warning/breach events + notifications.
 * Idempotent: SlaEvent has a unique (enquiryId, type), so re-runs do not
 * duplicate. (For multi-instance/distributed retries, move this to BullMQ — a
 * documented next phase; Redis is already in docker-compose.)
 */
@Injectable()
export class SlaScheduler {
  private readonly logger = new Logger(SlaScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async evaluate(): Promise<void> {
    const open = await this.prisma.enquiry.findMany({
      where: { status: EnquiryStatus.NEEDS_REPLY, firstRespondedAt: null },
      include: { slaPolicy: true },
    });

    for (const enquiry of open) {
      const { state, dueAt } = computeSla(enquiry, enquiry.slaPolicy);
      const type = state === 'breached' ? 'BREACH' : state === 'warning' ? 'WARNING' : null;
      if (!type) continue;

      try {
        await this.prisma.slaEvent.create({ data: { enquiryId: enquiry.id, type, dueAt } });
        await this.prisma.notification.create({
          data: {
            userId: enquiry.ownerId ?? undefined,
            type: `SLA_${type}`,
            title: type === 'BREACH' ? 'SLA breached' : 'SLA warning',
            entityType: 'Enquiry',
            entityId: enquiry.id,
          },
        });
      } catch {
        // Unique (enquiryId, type) → already raised. Idempotent no-op.
      }
    }
    if (open.length) this.logger.debug(`SLA evaluation scanned ${open.length} open enquiries`);
  }
}
