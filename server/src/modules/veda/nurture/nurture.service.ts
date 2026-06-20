import { Injectable, Logger } from '@nestjs/common';
import { Channel } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { VedaConfigService } from '../veda-config.service';
import { VedaLogService } from '../veda-log.service';
import { EmailDrafterService } from '../agents/email-drafter.service';
import { WhatsAppDrafterService } from '../agents/whatsapp-drafter.service';

interface NurtureStep {
  offsetHours: number; // from enrollment start
  channel: 'EMAIL' | 'WHATSAPP';
  angle: string;
}

// Default cadence — a gentle, premium multi-touch sequence for cold leads.
const SEQUENCE: NurtureStep[] = [
  { offsetHours: 24,  channel: 'EMAIL',    angle: 'a warm, no-pressure check-in — ask if they have any questions about the retreats' },
  { offsetHours: 72,  channel: 'WHATSAPP', angle: 'share briefly why guests love our retreats and invite them to a short discovery call' },
  { offsetHours: 168, channel: 'EMAIL',    angle: 'mention an upcoming cohort/date and offer to hold a spot; light, gentle urgency' },
  { offsetHours: 336, channel: 'WHATSAPP', angle: 'a final friendly touch — ask if the timing isn’t right and leave the door open warmly' },
];

const ENROLL_LOOKBACK_DAYS = 30;

@Injectable()
export class NurtureService {
  private readonly logger = new Logger(NurtureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: VedaConfigService,
    private readonly logs: VedaLogService,
    private readonly emailDrafter: EmailDrafterService,
    private readonly whatsappDrafter: WhatsAppDrafterService,
  ) {}

  /** Enroll eligible active leads that aren't already in a sequence. */
  async enrollEligible(limit = 10): Promise<number> {
    const since = new Date(Date.now() - ENROLL_LOOKBACK_DAYS * 86_400_000);
    const leads = await this.prisma.lead.findMany({
      where: {
        confirmedAt: null,
        closedLostAt: null,
        createdAt: { gte: since },
        nurture: { is: null },
      },
      select: { id: true },
      take: limit,
    });
    for (const lead of leads) {
      await this.prisma.nurtureEnrollment.create({
        data: {
          leadId: lead.id,
          status: 'ACTIVE',
          currentStep: 0,
          nextRunAt: new Date(Date.now() + SEQUENCE[0].offsetHours * 3600_000),
        },
      }).catch(() => undefined); // unique(leadId) guards races
    }
    return leads.length;
  }

  /** Execute any nurture steps that are due. */
  async runDue(limit = 10): Promise<void> {
    const due = await this.prisma.nurtureEnrollment.findMany({
      where: { status: 'ACTIVE', nextRunAt: { lte: new Date() } },
      orderBy: { nextRunAt: 'asc' },
      take: limit,
    });

    for (const enr of due) {
      const lead = await this.prisma.lead.findUnique({ where: { id: enr.leadId } });
      if (!lead) { await this.stop(enr.id, 'lead_deleted'); continue; }

      const stop = await this.shouldStop(enr.leadId, lead, enr.startedAt);
      if (stop) { await this.stop(enr.id, stop, stop === 'converted' ? 'COMPLETED' : 'STOPPED'); continue; }

      const step = SEQUENCE[enr.currentStep];
      if (!step) { await this.complete(enr.id); continue; }

      await this.executeStep(enr.leadId, step);

      const nextIndex = enr.currentStep + 1;
      if (nextIndex >= SEQUENCE.length) {
        await this.complete(enr.id);
      } else {
        await this.prisma.nurtureEnrollment.update({
          where: { id: enr.id },
          data: {
            currentStep: nextIndex,
            lastStepAt: new Date(),
            nextRunAt: new Date(enr.startedAt.getTime() + SEQUENCE[nextIndex].offsetHours * 3600_000),
          },
        });
      }
    }
  }

  private async executeStep(leadId: string, step: NurtureStep): Promise<void> {
    try {
      if (step.channel === 'EMAIL') await this.emailDrafter.draftForLead(leadId, step.angle);
      else await this.whatsappDrafter.draftForLead(leadId, step.angle);
      await this.logs.write({
        type: 'NURTURE_STEP', status: 'COMPLETED', entityType: 'Lead', entityId: leadId,
        output: { channel: step.channel, angle: step.angle } as object, completedAt: new Date(),
      });
    } catch (e) {
      await this.logs.write({
        type: 'NURTURE_STEP', status: 'FAILED', entityType: 'Lead', entityId: leadId, error: (e as Error).message,
      });
    }
  }

  /** Returns a stop reason if the lead should exit the sequence, else null. */
  private async shouldStop(
    leadId: string,
    lead: { confirmedAt: Date | null; closedLostAt: Date | null; contactId: string },
    startedAt: Date,
  ): Promise<string | null> {
    if (lead.confirmedAt) return 'converted';
    if (lead.closedLostAt) return 'closed_lost';

    const call = await this.prisma.discoveryCall.count({ where: { leadId, status: 'SCHEDULED' } });
    if (call) return 'call_booked';

    // If the client replied since enrollment, they're engaged — live chat handles it.
    const inbound = await this.prisma.message.count({
      where: { conversation: { contactId: lead.contactId }, direction: 'INBOUND', occurredAt: { gt: startedAt } },
    });
    if (inbound) return 'engaged';

    return null;
  }

  private async stop(id: string, reason: string, status: 'STOPPED' | 'COMPLETED' = 'STOPPED'): Promise<void> {
    await this.prisma.nurtureEnrollment.update({ where: { id }, data: { status, stoppedReason: reason } }).catch(() => undefined);
  }

  private async complete(id: string): Promise<void> {
    await this.prisma.nurtureEnrollment.update({ where: { id }, data: { status: 'COMPLETED', stoppedReason: 'sequence_complete' } }).catch(() => undefined);
  }
}
