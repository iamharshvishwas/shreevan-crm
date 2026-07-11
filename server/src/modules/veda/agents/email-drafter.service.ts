import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { OpenAiProvider } from '../ai/openai.provider';
import { VedaConfigService } from '../veda-config.service';
import { VedaApprovalService } from '../veda-approval.service';
import { VedaLogService } from '../veda-log.service';

interface EmailDraft {
  subject: string;
  body: string;
}

const SYSTEM_PROMPT = `You are Veda, the AI relationship agent for Shreevan Wellness, a premium Indian wellness-retreat business.

Write a warm, personal follow-up email to a prospective guest. Guidelines:
- Match the client's language: if they write in Hindi or Hinglish, reply in the same; otherwise English.
- Tone: calm, premium, caring — never pushy or salesy. Reflect a serene wellness brand.
- Reference their specific interest if known. Invite them to a short discovery call.
- Keep it concise (90-150 words). Sign off as "Veda · Shreevan Wellness".
- NEVER mention or ask about medical/health conditions.

Respond ONLY with JSON: { "subject", "body" }. The body is plain text with line breaks.`;

@Injectable()
export class EmailDrafterService {
  private readonly logger = new Logger(EmailDrafterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: OpenAiProvider,
    private readonly config: VedaConfigService,
    private readonly approvals: VedaApprovalService,
    private readonly logs: VedaLogService,
  ) {}

  /** Draft a follow-up email for a lead and queue it for approval (or auto-approve). */
  async draftForLead(leadId: string, angle?: string): Promise<void> {
    const started = Date.now();
    if (!this.ai.isConfigured()) return;

    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: { contact: { include: { identities: true } } },
    });
    if (!lead) return;

    const email = lead.contact.identities.find((i) => i.channel === 'EMAIL');
    if (!email) {
      await this.logs.write({ type: 'SEND_EMAIL', status: 'SKIPPED', entityType: 'Lead', entityId: leadId, error: 'No email address on contact.' });
      return;
    }

    const prompt = [
      `Client name: ${lead.contact.name}`,
      lead.contact.country ? `Country: ${lead.contact.country}` : '',
      lead.contact.language ? `Preferred language: ${lead.contact.language}` : '',
      lead.programInterest ? `Program interest: ${lead.programInterest}` : 'Program interest: not yet known',
      `Lead temperature: ${lead.temperature}`,
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
      const draft = this.ai.parseJson<EmailDraft>(result.message.content);
      if (!draft.subject || !draft.body) throw new Error('AI returned an incomplete draft.');

      const stepCfg = (await this.config.get()).steps.SEND_EMAIL;
      const autoApprove = stepCfg.autoApprove;

      const approval = await this.approvals.create({
        type: 'SEND_EMAIL',
        entityType: 'Lead',
        entityId: leadId,
        draftText: `Email to ${lead.contact.name} <${email.handle}> — "${draft.subject}"`,
        payload: { to: email.handle, subject: draft.subject, body: draft.body },
        context: { reasoning: `Drafted for a ${lead.temperature} lead`, language: lead.contact.language ?? 'auto' },
        expiresInHours: 72,
      });

      // Auto-approve flips it straight to APPROVED for the executor to send.
      if (autoApprove) {
        await this.approvals.approve(approval.id, 'veda-auto', 'Auto-approved by config');
      }

      await this.logs.write({
        type: 'SEND_EMAIL',
        status: autoApprove ? 'QUEUED' : 'COMPLETED', // COMPLETED = draft ready & awaiting human
        entityType: 'Lead',
        entityId: leadId,
        approvalId: approval.id,
        output: { subject: draft.subject, autoApprove } as object,
        costUsdMicro: result.costUsdMicro,
        durationMs: Date.now() - started,
        completedAt: new Date(),
      });
    } catch (e) {
      await this.logs.write({
        type: 'SEND_EMAIL',
        status: 'FAILED',
        entityType: 'Lead',
        entityId: leadId,
        error: (e as Error).message,
        durationMs: Date.now() - started,
      });
    }
  }

  /** Draft a program-info email for a live-chat visitor (no Lead yet — an
   *  Enquiry is enough) and queue it for approval. Returns synchronously
   *  whether it was actually queued, so a caller mid-conversation (Veda chat)
   *  can tell the visitor the truth instead of assuming success. */
  async draftForEnquiry(enquiryId: string, angle?: string): Promise<{ queued: boolean; reason?: string }> {
    const started = Date.now();
    if (!this.ai.isConfigured()) return { queued: false, reason: 'Veda is not connected to an AI provider.' };

    const enquiry = await this.prisma.enquiry.findUnique({
      where: { id: enquiryId },
      include: { contact: { include: { identities: true } } },
    });
    if (!enquiry) return { queued: false, reason: 'Enquiry not found.' };

    const email = enquiry.contact.identities.find((i) => i.channel === 'EMAIL');
    if (!email) {
      await this.logs.write({ type: 'SEND_EMAIL', status: 'SKIPPED', entityType: 'Enquiry', entityId: enquiryId, error: 'No email address on contact.' });
      return { queued: false, reason: 'No email address on file yet.' };
    }

    const prompt = [
      `Client name: ${enquiry.contact.name}`,
      enquiry.contact.country ? `Country: ${enquiry.contact.country}` : '',
      enquiry.contact.language ? `Preferred language: ${enquiry.contact.language}` : '',
      enquiry.programInterest ? `Program interest: ${enquiry.programInterest}` : 'Program interest: not yet known',
      angle ?? 'They asked Veda for program details during a live chat — send an overview + invite to a discovery call.',
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
      const draft = this.ai.parseJson<EmailDraft>(result.message.content);
      if (!draft.subject || !draft.body) throw new Error('AI returned an incomplete draft.');

      const autoApprove = (await this.config.get()).steps.SEND_EMAIL.autoApprove;

      const approval = await this.approvals.create({
        type: 'SEND_EMAIL',
        entityType: 'Enquiry',
        entityId: enquiryId,
        draftText: `Email to ${enquiry.contact.name} <${email.handle}> — "${draft.subject}"`,
        payload: { to: email.handle, subject: draft.subject, body: draft.body },
        context: { reasoning: 'Requested by the visitor in live chat', language: enquiry.contact.language ?? 'auto' },
        expiresInHours: 72,
      });

      if (autoApprove) {
        await this.approvals.approve(approval.id, 'veda-auto', 'Auto-approved by config');
      }

      await this.logs.write({
        type: 'SEND_EMAIL',
        status: autoApprove ? 'QUEUED' : 'COMPLETED',
        entityType: 'Enquiry',
        entityId: enquiryId,
        approvalId: approval.id,
        output: { subject: draft.subject, autoApprove } as object,
        costUsdMicro: result.costUsdMicro,
        durationMs: Date.now() - started,
        completedAt: new Date(),
      });
      return { queued: true };
    } catch (e) {
      await this.logs.write({
        type: 'SEND_EMAIL',
        status: 'FAILED',
        entityType: 'Enquiry',
        entityId: enquiryId,
        error: (e as Error).message,
        durationMs: Date.now() - started,
      });
      return { queued: false, reason: 'Something went wrong drafting the email.' };
    }
  }
}
