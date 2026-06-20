import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Channel } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { VedaConfigService } from './veda-config.service';
import { VedaApprovalService } from './veda-approval.service';
import { formatIst } from './channels/slots.util';

// Call for slots that are due, but not ones missed long ago (e.g. while Veda was off).
const OVERDUE_GRACE_MS = 6 * 3600_000;

@Injectable()
export class VedaVoiceSchedulerService {
  private readonly logger = new Logger(VedaVoiceSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: VedaConfigService,
    private readonly approvals: VedaApprovalService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (!(await this.config.isGloballyEnabled())) return;
    if (!(await this.config.isStepEnabled('VOICE_CALL'))) return;

    const now = new Date();
    const earliest = new Date(now.getTime() - OVERDUE_GRACE_MS);

    const due = await this.prisma.discoveryCall.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: now, gte: earliest } },
      include: {
        contact: { include: { identities: true } },
        lead: { select: { programInterest: true } },
      },
      take: 10,
    });
    if (!due.length) return;

    const autoApprove = (await this.config.get()).steps.VOICE_CALL.autoApprove;

    for (const call of due) {
      // Dedup: one VOICE_CALL approval per discovery call.
      const existing = await this.prisma.vedaApproval.count({
        where: { type: 'VOICE_CALL', entityType: 'DiscoveryCall', entityId: call.id },
      });
      if (existing) continue;

      const phoneIdentity =
        call.contact?.identities.find((i) => i.channel === Channel.WHATSAPP) ??
        call.contact?.identities.find((i) => i.channel === Channel.PHONE);
      if (!phoneIdentity || !call.contact) continue; // no number to call

      const approval = await this.approvals.create({
        type: 'VOICE_CALL',
        entityType: 'DiscoveryCall',
        entityId: call.id,
        draftText: `Call ${call.contact.name} (${phoneIdentity.handle}) for their discovery call at ${formatIst(call.scheduledAt.toISOString())}`,
        payload: {
          to: phoneIdentity.handle,
          leadName: call.contact.name,
          programInterest: call.lead?.programInterest ?? null,
          language: call.contact.language ?? null,
          discoveryCallId: call.id,
        },
        context: { scheduledAt: call.scheduledAt.toISOString() },
        expiresInHours: 6,
      });

      if (autoApprove) {
        await this.approvals.approve(approval.id, 'veda-auto', 'Auto-approved by config');
      }
    }
    this.logger.debug(`Voice scheduler evaluated ${due.length} due call(s)`);
  }
}
