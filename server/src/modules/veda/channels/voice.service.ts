import { Injectable, Logger } from '@nestjs/common';
import { Channel } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { normalizeHandle } from '../../contacts/identity.util';
import { RedactionService } from '../ai/redaction.service';
import { VedaConfigService } from '../veda-config.service';
import { VedaLogService } from '../veda-log.service';
import { EmailDrafterService } from '../agents/email-drafter.service';

// Defensive extraction — Vapi's report shape has shifted across versions.
interface VapiMessage {
  type?: string;
  call?: {
    id?: string;
    type?: string; // inboundPhoneCall | outboundPhoneCall
    metadata?: { discoveryCallId?: string };
    customer?: { number?: string; name?: string };
  };
  artifact?: { transcript?: string; recordingUrl?: string; recording?: { url?: string } };
  analysis?: { summary?: string };
  summary?: string;
  transcript?: string;
  recordingUrl?: string;
  endedReason?: string;
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redaction: RedactionService,
    private readonly config: VedaConfigService,
    private readonly logs: VedaLogService,
    private readonly emailDrafter: EmailDrafterService,
  ) {}

  /** Handle a Vapi webhook message. Only end-of-call reports are processed. */
  async handleMessage(message: VapiMessage): Promise<void> {
    if (message.type !== 'end-of-call-report') return;
    await this.processEndOfCall(message);
  }

  private async processEndOfCall(m: VapiMessage): Promise<void> {
    const started = Date.now();
    const vapiCallId = m.call?.id;
    const discoveryCallId = m.call?.metadata?.discoveryCallId;

    let call = discoveryCallId
      ? await this.prisma.discoveryCall.findUnique({ where: { id: discoveryCallId }, include: { lead: true } })
      : vapiCallId
        ? await this.prisma.discoveryCall.findFirst({ where: { externalCallId: vapiCallId }, include: { lead: true } })
        : null;

    // Inbound call (someone rang us): no pre-existing DiscoveryCall — create one from the caller.
    if (!call) call = await this.createInboundCall(m);

    if (!call) {
      this.logger.warn(`Vapi report for unknown call (vapi=${vapiCallId})`);
      await this.logs.write({ type: 'VOICE_COMPLETED', status: 'FAILED', error: 'No matching DiscoveryCall and no caller number.', input: { vapiCallId } as object });
      return;
    }

    const rawTranscript = m.artifact?.transcript ?? m.transcript ?? '';
    const rawSummary = m.analysis?.summary ?? m.summary ?? '';
    const recordingUrl = m.artifact?.recordingUrl ?? m.artifact?.recording?.url ?? m.recordingUrl ?? null;

    // Domain rule: NEVER store medical/health detail — redact before persisting.
    const [transcript, summary] = await Promise.all([
      this.redaction.redact(rawTranscript),
      this.redaction.redact(rawSummary),
    ]);

    await this.prisma.discoveryCall.update({
      where: { id: call.id },
      data: {
        status: 'COMPLETED',
        externalCallId: vapiCallId ?? call.externalCallId,
        recordingUrl,
        transcriptRedacted: transcript.text || null,
        summary: summary.text || null,
        outcome: (summary.text || 'AI voice call completed').slice(0, 280),
      },
    });

    if (call.leadId) {
      await this.prisma.leadActivity.create({
        data: { leadId: call.leadId, type: 'VEDA', title: 'Veda completed an AI voice call', body: (summary.text || '').slice(0, 200) || `Ended: ${m.endedReason ?? 'completed'}` },
      }).catch(() => undefined);
    }

    await this.logs.write({
      type: 'VOICE_COMPLETED', status: 'COMPLETED', entityType: 'DiscoveryCall', entityId: call.id,
      output: { recording: !!recordingUrl, redaction: transcript.method, endedReason: m.endedReason } as object,
      durationMs: Date.now() - started, completedAt: new Date(),
    });

    // Chain: draft a post-call follow-up email if that step is enabled.
    if (call.leadId && (await this.config.isStepEnabled('SEND_EMAIL'))) {
      await this.emailDrafter.draftForLead(call.leadId).catch((e) =>
        this.logger.warn(`Post-call email draft failed: ${e.message}`),
      );
    }
  }

  /**
   * Build a DiscoveryCall record for an inbound call, resolving (or creating)
   * the caller's contact by phone number. Returns the call (with lead) or null
   * if there's no caller number to work with.
   */
  private async createInboundCall(m: VapiMessage) {
    const number = m.call?.customer?.number;
    if (!number) return null;

    const normalized = normalizeHandle(Channel.WHATSAPP, number); // phone normalization
    let contactId: string;
    let leadId: string | null = null;

    const identity = await this.prisma.contactIdentity.findFirst({
      where: { normalizedHandle: normalized, channel: { in: [Channel.WHATSAPP, Channel.PHONE] } },
      include: { contact: { include: { leads: { where: { confirmedAt: null, closedLostAt: null }, orderBy: { updatedAt: 'desc' }, take: 1 } } } },
    });

    if (identity) {
      contactId = identity.contactId;
      leadId = identity.contact.leads[0]?.id ?? null;
    } else {
      const contact = await this.prisma.contact.create({
        data: {
          name: m.call?.customer?.name?.trim() || number,
          firstTouchSource: Channel.PHONE,
          identities: { create: { channel: Channel.PHONE, handle: number, normalizedHandle: normalized, verified: true } },
        },
      });
      contactId = contact.id;
    }

    return this.prisma.discoveryCall.create({
      data: {
        contactId,
        leadId,
        scheduledAt: new Date(),
        timezone: 'Asia/Kolkata',
        status: 'SCHEDULED', // set COMPLETED by the caller after we fill the report
        externalCallId: m.call?.id,
        prepNotes: 'Inbound call answered by Veda',
      },
      include: { lead: true },
    });
  }
}
