import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { VedaConfigService } from './veda-config.service';
import { VedaApprovalService } from './veda-approval.service';
import { LeadQualifierService } from './agents/lead-qualifier.service';

// Only auto-qualify reasonably fresh leads, and a few per tick, to bound cost.
const LOOKBACK_DAYS = 7;
const BATCH_PER_TICK = 3;

@Injectable()
export class VedaSchedulerService {
  private readonly logger = new Logger(VedaSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: VedaConfigService,
    private readonly approvals: VedaApprovalService,
    private readonly qualifier: LeadQualifierService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    // Always expire stale pending approvals, regardless of enablement.
    const expired = await this.approvals.expireStale();
    if (expired) this.logger.debug(`Expired ${expired} stale approvals`);

    if (!(await this.config.isGloballyEnabled())) return;
    if (!(await this.config.isStepEnabled('QUALIFY_LEAD'))) return;

    const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
    const candidates = await this.prisma.lead.findMany({
      where: { createdAt: { gte: since }, confirmedAt: null, closedLostAt: null },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true },
    });
    if (!candidates.length) return;

    const ids = candidates.map((c) => c.id);
    const alreadyLogged = await this.prisma.vedaActionLog.findMany({
      where: { type: 'QUALIFY_LEAD', entityId: { in: ids } },
      select: { entityId: true },
    });
    const done = new Set(alreadyLogged.map((l) => l.entityId));
    const pending = ids.filter((id) => !done.has(id)).slice(0, BATCH_PER_TICK);

    for (const leadId of pending) {
      await this.qualifier.qualify(leadId);
    }
    if (pending.length) this.logger.debug(`Veda qualified ${pending.length} new lead(s)`);
  }
}
