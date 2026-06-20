import { Injectable, Logger } from '@nestjs/common';
import { Channel } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { OpenAiProvider } from '../ai/openai.provider';
import { VedaConfigService } from '../veda-config.service';
import { VedaApprovalService } from '../veda-approval.service';
import { VedaLogService } from '../veda-log.service';
import { proposeSlots } from '../channels/slots.util';

const SYSTEM_PROMPT = `You are Veda, the AI relationship agent for Shreevan Wellness, a premium Indian wellness-retreat business.

Write a short, warm WhatsApp opening message to a prospective guest, inviting them to a brief discovery call.
- Match their language: Hindi/Hinglish if they wrote that way, else English.
- Tone: calm, premium, caring — never pushy. A light emoji (🌿) is fine.
- Keep it under 55 words. Do NOT include the slot options (the system adds tappable buttons).
- NEVER mention or ask about medical/health conditions.
- Sign off as "— Veda, Shreevan Wellness".

Respond ONLY with JSON: { "message" }.`;

@Injectable()
export class WhatsAppDrafterService {
  private readonly logger = new Logger(WhatsAppDrafterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: OpenAiProvider,
    private readonly config: VedaConfigService,
    private readonly approvals: VedaApprovalService,
    private readonly logs: VedaLogService,
  ) {}

  /** Draft a WhatsApp greeting + slot invite for a lead and queue it for approval. */
  async draftForLead(leadId: string, angle?: string): Promise<void> {
    const started = Date.now();
    if (!this.ai.isConfigured()) return;

    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { contact: { include: { identities: true } } },
    });
    if (!lead) return;

    const wa = lead.contact.identities.find((i) => i.channel === Channel.WHATSAPP);
    if (!wa) {
      await this.logs.write({ type: 'SEND_WHATSAPP', status: 'SKIPPED', entityType: 'Lead', entityId: leadId, error: 'No WhatsApp number on contact.' });
      return;
    }

    const prompt = [
      `Client name: ${lead.contact.name}`,
      lead.contact.language ? `Preferred language: ${lead.contact.language}` : '',
      lead.programInterest ? `Program interest: ${lead.programInterest}` : 'Program interest: not yet known',
      angle ? `Angle for this message: ${angle}` : '',
    ].filter(Boolean).join('\n');

    try {
      const result = await this.ai.chat({
        jsonMode: true,
        temperature: 0.7,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      });
      const draft = this.ai.parseJson<{ message: string }>(result.message.content);
      if (!draft.message) throw new Error('AI returned an empty message.');

      const slots = proposeSlots(3);
      const autoApprove = (await this.config.get()).steps.SEND_WHATSAPP.autoApprove;

      const approval = await this.approvals.create({
        type: 'SEND_WHATSAPP',
        entityType: 'Lead',
        entityId: leadId,
        draftText: `WhatsApp to ${lead.contact.name} (${wa.handle}): "${draft.message}" + ${slots.length} call slots`,
        payload: {
          to: wa.handle,
          contactId: lead.contactId,
          body: draft.message,
          slots, // [{ iso, label }]
        },
        context: { language: lead.contact.language ?? 'auto' },
        expiresInHours: 48,
      });

      if (autoApprove) {
        await this.approvals.approve(approval.id, 'veda-auto', 'Auto-approved by config');
      }

      await this.logs.write({
        type: 'SEND_WHATSAPP',
        status: autoApprove ? 'QUEUED' : 'COMPLETED',
        entityType: 'Lead',
        entityId: leadId,
        approvalId: approval.id,
        output: { autoApprove, slots: slots.length } as object,
        costUsdMicro: result.costUsdMicro,
        durationMs: Date.now() - started,
        completedAt: new Date(),
      });
    } catch (e) {
      await this.logs.write({
        type: 'SEND_WHATSAPP', status: 'FAILED', entityType: 'Lead', entityId: leadId,
        error: (e as Error).message, durationMs: Date.now() - started,
      });
    }
  }
}
