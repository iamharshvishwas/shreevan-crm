import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Channel } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { VedaConfigService } from './veda-config.service';
import { VedaApprovalService } from './veda-approval.service';
import { VedaLogService } from './veda-log.service';
import { formatIst } from './channels/slots.util';

// Call for slots that are due, but not ones missed long ago (e.g. while Veda was off).
const OVERDUE_GRACE_MS = 6 * 3600_000;

// Records Veda has created itself (inbound, test) must never be picked up as
// outbound "due calls". We tag them with these prep-note markers at creation.
const SKIP_PREPNOTE_MARKERS = ['Veda test call', 'Inbound call answered by Veda'];

// E.164 sanity check — bounces seed/fake numbers like "+91 demo" or invalid junk.
const E164 = /^\+[1-9]\d{7,14}$/;

@Injectable()
export class VedaVoiceSchedulerService {
  private readonly logger = new Logger(VedaVoiceSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: VedaConfigService,
    private readonly approvals: VedaApprovalService,
    private readonly logs: VedaLogService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (!(await this.config.isGloballyEnabled())) return;
    if (!(await this.config.isStepEnabled('VOICE_CALL'))) return;

    const now = new Date();
    const earliest = new Date(now.getTime() - OVERDUE_GRACE_MS);

    const due = await this.prisma.discoveryCall.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: now, gte: earliest },
        // Hard requirement: only call when there's a real active lead behind the slot.
        // No lead = no business reason for Veda to dial.
        leadId: { not: null },
        lead: { confirmedAt: null, closedLostAt: null },
      },
      include: {
        contact: { include: { identities: true } },
        lead: { select: { programInterest: true } },
      },
      take: 10,
    });
    if (!due.length) return;

    const autoApprove = (await this.config.get()).steps.VOICE_CALL.autoApprove;
    const cfg = await this.config.get();
    if (inQuietHours(now, cfg.quietHoursStart, cfg.quietHoursEnd, cfg.quietHoursTimezone)) {
      this.logger.debug('Voice scheduler skipped (quiet hours)');
      return;
    }

    let queued = 0;
    let skipped = 0;
    for (const call of due) {
      // Dedup: one VOICE_CALL approval per discovery call (handles retries).
      const existing = await this.prisma.vedaApproval.count({
        where: { type: 'VOICE_CALL', entityType: 'DiscoveryCall', entityId: call.id },
      });
      if (existing) { skipped++; continue; }

      // Skip Veda's own records (inbound, test). They aren't real outbound work.
      if (call.prepNotes && SKIP_PREPNOTE_MARKERS.some((m) => call.prepNotes!.includes(m))) {
        skipped++;
        continue;
      }

      if (!call.contact) { skipped++; continue; }

      const phoneIdentity =
        call.contact.identities.find((i) => i.channel === Channel.WHATSAPP) ??
        call.contact.identities.find((i) => i.channel === Channel.PHONE);
      if (!phoneIdentity) { skipped++; continue; }

      // Reject obviously-bad numbers so we never burn credits on seed/demo data.
      const handle = phoneIdentity.handle.replace(/\s|-/g, '');
      if (!E164.test(handle)) {
        skipped++;
        await this.logs.write({
          type: 'VOICE_PLACED', status: 'SKIPPED', entityType: 'DiscoveryCall', entityId: call.id,
          error: `Invalid phone number for outbound call: ${phoneIdentity.handle}`,
        });
        continue;
      }

      const approval = await this.approvals.create({
        type: 'VOICE_CALL',
        entityType: 'DiscoveryCall',
        entityId: call.id,
        draftText: `Call ${call.contact.name} (${handle}) for their discovery call at ${formatIst(call.scheduledAt.toISOString())}`,
        payload: {
          to: handle,
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
      queued++;
    }
    if (queued || skipped) this.logger.debug(`Voice scheduler: ${queued} queued, ${skipped} skipped`);
  }
}

/** True if `now` falls inside the configured quiet-hours window in that timezone. */
function inQuietHours(now: Date, startHHMM: string, endHHMM: string, tz: string): boolean {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
    const cur = fmt.format(now); // "HH:MM"
    // Window may wrap midnight (e.g. 22:00 → 08:00).
    return startHHMM <= endHHMM
      ? cur >= startHHMM && cur < endHHMM
      : cur >= startHHMM || cur < endHHMM;
  } catch {
    return false;
  }
}
