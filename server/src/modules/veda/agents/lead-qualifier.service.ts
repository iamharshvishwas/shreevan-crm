import { Injectable, Logger } from '@nestjs/common';
import { Temperature } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { OpenAiProvider } from '../ai/openai.provider';
import { VedaConfigService } from '../veda-config.service';
import { VedaLogService } from '../veda-log.service';
import { EmailDrafterService } from './email-drafter.service';
import { WhatsAppDrafterService } from './whatsapp-drafter.service';

interface Qualification {
  programInterest: string | null;
  temperature: 'HOT' | 'WARM' | 'COLD';
  language: string | null;
  urgency: 'high' | 'medium' | 'low';
  budgetSignal: string | null;
  summary: string;
}

const SYSTEM_PROMPT = `You are Veda, the AI relationship agent for Shreevan Wellness, a premium Indian wellness-retreat business serving Indian and international clients.

Read the lead context and extract a structured qualification. Detect the language the client writes in (Hindi, English, or Hinglish).

IMPORTANT RULES:
- NEVER record any medical or health details (conditions, diagnoses, symptoms). Only note general program interest.
- programInterest: the retreat/program they seem interested in, or null if unclear.
- temperature: HOT (ready to book / urgent / strong intent), WARM (interested, exploring), COLD (vague / early / low intent).
- language: "Hindi", "English", or "Hinglish".
- urgency: high / medium / low based on timeline signals.
- budgetSignal: a short note on budget/affordability cues, or null.
- summary: 1-2 sentence plain summary for the relationship manager.

Respond ONLY with a JSON object: { "programInterest", "temperature", "language", "urgency", "budgetSignal", "summary" }.`;

@Injectable()
export class LeadQualifierService {
  private readonly logger = new Logger(LeadQualifierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: OpenAiProvider,
    private readonly config: VedaConfigService,
    private readonly logs: VedaLogService,
    private readonly emailDrafter: EmailDrafterService,
    private readonly whatsappDrafter: WhatsAppDrafterService,
  ) {}

  /** Qualify a single lead. Safe to call repeatedly — dedup happens in the scheduler. */
  async qualify(leadId: string): Promise<void> {
    const started = Date.now();

    if (!this.ai.isConfigured()) {
      await this.logs.write({ type: 'QUALIFY_LEAD', status: 'SKIPPED', entityType: 'Lead', entityId: leadId, error: 'OpenAI not configured.' });
      return;
    }
    if (!(await this.config.isStepEnabled('QUALIFY_LEAD'))) {
      await this.logs.write({ type: 'QUALIFY_LEAD', status: 'SKIPPED', entityType: 'Lead', entityId: leadId, error: 'Step disabled.' });
      return;
    }

    const context = await this.gatherContext(leadId);
    if (!context) {
      await this.logs.write({ type: 'QUALIFY_LEAD', status: 'FAILED', entityType: 'Lead', entityId: leadId, error: 'Lead not found.' });
      return;
    }

    try {
      const result = await this.ai.chat({
        jsonMode: true,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: context.prompt },
        ],
      });
      const q = this.ai.parseJson<Qualification>(result.message.content);

      await this.apply(leadId, context.contactId, q);

      await this.logs.write({
        type: 'QUALIFY_LEAD',
        status: 'COMPLETED',
        entityType: 'Lead',
        entityId: leadId,
        output: q as object,
        costUsdMicro: result.costUsdMicro,
        durationMs: Date.now() - started,
        completedAt: new Date(),
      });

      // Chain drafts only when the Brain is OFF — with the Brain on, first-touch
      // outreach already happened at enquiry time; drafting again here would
      // double-message the same lead after conversion.
      const brainOwnsOutreach = await this.config.isStepEnabled('BRAIN');
      if (!brainOwnsOutreach && (await this.config.isStepEnabled('SEND_EMAIL'))) {
        await this.emailDrafter.draftForLead(leadId).catch((e) =>
          this.logger.warn(`Email draft after qualify failed: ${e.message}`),
        );
      }
      if (!brainOwnsOutreach && (await this.config.isStepEnabled('SEND_WHATSAPP'))) {
        await this.whatsappDrafter.draftForLead(leadId).catch((e) =>
          this.logger.warn(`WhatsApp draft after qualify failed: ${e.message}`),
        );
      }
    } catch (e) {
      await this.logs.write({
        type: 'QUALIFY_LEAD',
        status: 'FAILED',
        entityType: 'Lead',
        entityId: leadId,
        error: (e as Error).message,
        durationMs: Date.now() - started,
      });
    }
  }

  private async apply(leadId: string, contactId: string, q: Qualification): Promise<void> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    const temp = (['HOT', 'WARM', 'COLD'] as const).includes(q.temperature) ? (q.temperature as Temperature) : lead.temperature;

    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        temperature: temp,
        // Only fill programInterest if the human hasn't set it.
        programInterest: lead.programInterest ?? q.programInterest ?? undefined,
      },
    });

    if (q.language) {
      const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
      if (contact && !contact.language) {
        await this.prisma.contact.update({ where: { id: contactId }, data: { language: q.language } });
      }
    }

    await this.prisma.leadActivity.create({
      data: {
        leadId,
        type: 'VEDA',
        title: 'Veda qualified this lead',
        body: [
          q.summary,
          q.programInterest ? `Interest: ${q.programInterest}` : null,
          `Temperature: ${q.temperature} · Urgency: ${q.urgency}`,
          q.budgetSignal ? `Budget: ${q.budgetSignal}` : null,
          q.language ? `Language: ${q.language}` : null,
        ].filter(Boolean).join(' · '),
      },
    });
  }

  /** Build the qualification prompt from contact + recent inbound messages. */
  private async gatherContext(leadId: string): Promise<{ prompt: string; contactId: string } | null> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        contact: { include: { identities: true } },
        enquiry: true,
        notes: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!lead) return null;

    const messages = await this.prisma.message.findMany({
      where: { conversation: { contactId: lead.contactId }, direction: 'INBOUND' },
      orderBy: { occurredAt: 'desc' },
      take: 10,
    });

    const lines: string[] = [
      `Contact name: ${lead.contact.name}`,
      lead.contact.country ? `Country: ${lead.contact.country}` : '',
      lead.firstTouchSource ? `First touch source: ${lead.firstTouchSource}` : '',
      lead.programInterest ? `Existing program interest: ${lead.programInterest}` : '',
      lead.enquiry?.programInterest ? `Enquiry interest: ${lead.enquiry.programInterest}` : '',
      '',
      'Recent messages from the client (most recent first):',
      ...(messages.length
        ? messages.map((m) => `- ${m.body}`)
        : ['(no messages on record)']),
      '',
      ...(lead.notes.length ? ['Internal notes:', ...lead.notes.map((n) => `- ${n.body}`)] : []),
    ].filter((l) => l !== '');

    return { prompt: lines.join('\n'), contactId: lead.contactId };
  }
}
