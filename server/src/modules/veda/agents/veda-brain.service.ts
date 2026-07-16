import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Channel, MessageDirection } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { OpenAiProvider } from '../ai/openai.provider';
import { VedaApprovalService } from '../veda-approval.service';
import { VedaConfigService } from '../veda-config.service';
import { VedaLogService } from '../veda-log.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { proposeSlots } from '../channels/slots.util';

/** How Veda understood an inbound lead — extracted by AI, heuristics as fallback. */
export interface Intent {
  need: 'PROGRAM_INFO' | 'PRICING' | 'BOOKING' | 'AVAILABILITY' | 'QUESTION' | 'OTHER';
  programInterest: string | null;
  language: string | null;
  urgency: 'high' | 'medium' | 'low';
  wantsDetails: boolean;
  summary: string;
}

const LOOKBACK_DAYS = 3;
const BATCH_PER_TICK = 5;
const DEDUPE_WINDOW_MS = 48 * 3600_000;

const INTENT_PROMPT = `You are Veda, the AI relationship agent for Shreevan Wellness, a premium Indian wellness-retreat business.

Read what a prospective guest wrote (a chat/WhatsApp/email message, an ad-form submission, or a phone-call transcript) and extract what they actually NEED.

RULES:
- NEVER record any medical or health details. Only general program interest.
- need: PROGRAM_INFO (wants details of a program/retreat), PRICING, BOOKING (wants to book/reserve), AVAILABILITY (dates/slots), QUESTION (a specific question), OTHER.
- programInterest: the program they mean (e.g. "7-Day Retreat", "28-Day Personal Reset"), or null.
- language: "Hindi", "English", or "Hinglish" — how they write/speak.
- urgency: high / medium / low from timeline signals.
- wantsDetails: true if they asked to be SENT details/brochure/pricing/info (on any channel), or if this is an ad/form lead expressing interest in a program.
- summary: 1-2 plain sentences for the team: who wants what.

Respond ONLY with JSON: { "need", "programInterest", "language", "urgency", "wantsDetails", "summary" }.`;

const COMPOSE_PROMPT = `You are Veda, the AI relationship agent for Shreevan Wellness, a premium Indian wellness-retreat business.

Write an email that DIRECTLY serves what this guest asked for — if they wanted program details, give the actual details (from the knowledge provided); if pricing, give pricing; always grounded ONLY in the knowledge and program list provided. Never invent prices, dates, or claims.

STYLE:
- Match the guest's language (Hindi / English / Hinglish).
- Calm, warm, premium — never pushy. Write like a thoughtful person, not a template.
- Use their name at most once. At most one exclamation mark. No "feel free to" / "don't hesitate".
- 120-200 words. End with ONE concrete next step (e.g. reply to this email, or a discovery call).
- Sign off as "Veda · Shreevan Wellness".
- NEVER mention or ask about medical/health conditions.

Respond ONLY with JSON: { "subject", "body" } (body = plain text with line breaks).`;

/**
 * Veda's Brain — the single autonomous loop over every inbound lead, whatever
 * the channel (live chat, website form, Meta/Google ads, WhatsApp, email,
 * calls). For each new enquiry it: understands the need (intent), records that
 * understanding for the team, then composes and queues the right outreach on
 * the right channel(s) as PRE-APPROVED actions — the executor delivers them
 * within ~30s under the existing guard-rails (quiet hours, daily cap, WhatsApp
 * 24h-window/template rules, retries). No human wait.
 *
 * Runs as a poller over enquiries (like the lead scheduler) so every current
 * and future channel is covered by construction — anything that reaches the
 * ingestion funnel reaches the Brain, with zero coupling into the adapters.
 */
@Injectable()
export class VedaBrainService {
  private readonly logger = new Logger(VedaBrainService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: OpenAiProvider,
    private readonly approvals: VedaApprovalService,
    private readonly config: VedaConfigService,
    private readonly logs: VedaLogService,
    private readonly knowledge: KnowledgeService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async tick(): Promise<void> {
    if (this.running) return; // a slow AI call must not stack ticks
    this.running = true;
    try {
      if (!(await this.config.isStepEnabled('BRAIN'))) return;

      const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
      const candidates = await this.prisma.enquiry.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { id: true },
      });
      if (!candidates.length) return;

      // One Brain pass per enquiry — the BRAIN action log is the claim.
      const ids = candidates.map((c) => c.id);
      const done = await this.prisma.vedaActionLog.findMany({
        where: { type: 'BRAIN', entityType: 'Enquiry', entityId: { in: ids } },
        select: { entityId: true },
      });
      const doneSet = new Set(done.map((d) => d.entityId));
      const pending = ids.filter((id) => !doneSet.has(id)).slice(0, BATCH_PER_TICK);

      for (const id of pending) {
        await this.processEnquiry(id).catch((e) =>
          this.logger.error(`Brain failed for enquiry ${id}: ${(e as Error).message}`),
        );
      }
    } finally {
      this.running = false;
    }
  }

  /** Understand one enquiry and act on it. Public for tests. */
  async processEnquiry(enquiryId: string): Promise<void> {
    const started = Date.now();
    const enquiry = await this.prisma.enquiry.findUnique({
      where: { id: enquiryId },
      include: {
        contact: { include: { identities: true } },
        conversations: {
          include: { messages: { orderBy: { occurredAt: 'desc' }, take: 8 } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!enquiry) return;

    const messages = enquiry.conversations[0]?.messages ?? [];
    const inbound = messages.filter((m) => m.direction === MessageDirection.INBOUND);
    const sourceText = inbound.map((m) => m.body).reverse().join('\n') || '(no message text)';
    // Someone (Veda chat/email/WhatsApp auto-reply) already answered in-thread?
    const conversationalReplyHandled = messages.some((m) => m.direction === MessageDirection.OUTBOUND);

    const intent = await this.extractIntent(sourceText, enquiry.contact.name);

    // Record the understanding: fill fields the team hasn't set + a note in the thread.
    if (intent.programInterest && !enquiry.programInterest) {
      await this.prisma.enquiry.update({ where: { id: enquiryId }, data: { programInterest: intent.programInterest } }).catch(() => undefined);
    }
    if (intent.language && !enquiry.contact.language) {
      await this.prisma.contact.update({ where: { id: enquiry.contactId }, data: { language: intent.language } }).catch(() => undefined);
    }
    await this.prisma.internalNote.create({
      data: {
        enquiryId,
        authorName: 'Veda',
        body: `🧠 ${intent.summary} · Need: ${intent.need} · Urgency: ${intent.urgency}${intent.programInterest ? ` · Interest: ${intent.programInterest}` : ''}`,
      },
    }).catch(() => undefined);

    // Decide + queue outreach.
    const email = enquiry.contact.identities.find((i) => i.channel === Channel.EMAIL)?.handle ?? null;
    const phone = enquiry.contact.identities.find((i) => i.channel === Channel.WHATSAPP)?.handle ?? null;
    const cfg = await this.config.get();
    const actions: string[] = [];

    const wantEmail = email && cfg.steps.SEND_EMAIL.enabled
      && (!conversationalReplyHandled || (intent.wantsDetails && enquiry.channel !== Channel.EMAIL));
    const wantWa = phone && cfg.steps.SEND_WHATSAPP.enabled
      && (!conversationalReplyHandled || (intent.wantsDetails && enquiry.channel !== Channel.WHATSAPP));

    if (wantEmail && !(await this.alreadyQueued('SEND_EMAIL', 'Enquiry', enquiryId))) {
      const draft = await this.composeEmail(enquiry.contact.name, intent, sourceText);
      if (draft) {
        await this.queue('SEND_EMAIL', 'Enquiry', enquiryId, `Email to ${enquiry.contact.name} <${email}> — "${draft.subject}"`,
          { to: email, subject: draft.subject, body: draft.body }, intent, cfg.steps.BRAIN.autoApprove);
        actions.push(`email→${email}`);
      }
    }

    if (wantWa && !(await this.alreadyQueued('SEND_WHATSAPP', 'Enquiry', enquiryId))) {
      // Body is used inside the 24h window; outside it the executor sends the
      // pre-approved greeting template automatically. Slot buttons ride along
      // in-window so the guest can book a discovery call in one tap.
      const slots = proposeSlots();
      const waBody = this.waBody(enquiry.contact.name, intent);
      await this.queue('SEND_WHATSAPP', 'Enquiry', enquiryId, `WhatsApp to ${enquiry.contact.name} (${phone})`,
        { to: phone, contactId: enquiry.contactId, name: enquiry.contact.name, body: waBody, slots: slots.map((s) => ({ iso: s.iso, label: s.label })) },
        intent, cfg.steps.BRAIN.autoApprove);
      actions.push(`whatsapp→${phone}`);
    }

    await this.logs.write({
      type: 'BRAIN', status: 'COMPLETED', entityType: 'Enquiry', entityId: enquiryId,
      output: { intent, actions, conversationalReplyHandled } as object,
      durationMs: Date.now() - started, completedAt: new Date(),
    });
  }

  /** After an AI voice call: read the (health-redacted) transcript, understand
   *  what the caller wanted, and follow up on their channels — autonomously. */
  async processPostCall(discoveryCallId: string): Promise<void> {
    const started = Date.now();
    if (!(await this.config.isStepEnabled('BRAIN'))) return;

    const call = await this.prisma.discoveryCall.findUnique({
      where: { id: discoveryCallId },
      include: { contact: { include: { identities: true } } },
    });
    if (!call?.contact) return;

    const sourceText = [call.summary, call.transcriptRedacted].filter(Boolean).join('\n\n').slice(0, 6000);
    if (!sourceText.trim()) return;

    const intent = await this.extractIntent(sourceText, call.contact.name);
    const email = call.contact.identities.find((i) => i.channel === Channel.EMAIL)?.handle ?? null;
    const phone = call.contact.identities.find((i) => i.channel === Channel.WHATSAPP)?.handle ?? null;
    const cfg = await this.config.get();
    const actions: string[] = [];

    if (email && cfg.steps.SEND_EMAIL.enabled && !(await this.alreadyQueued('SEND_EMAIL', 'DiscoveryCall', discoveryCallId))) {
      const draft = await this.composeEmail(call.contact.name, intent, `They just finished a phone call with Veda. Call summary/transcript:\n${sourceText}`);
      if (draft) {
        await this.queue('SEND_EMAIL', 'DiscoveryCall', discoveryCallId, `Post-call email to ${call.contact.name} <${email}> — "${draft.subject}"`,
          { to: email, subject: draft.subject, body: draft.body }, intent, cfg.steps.BRAIN.autoApprove);
        actions.push(`email→${email}`);
      }
    }
    if (phone && cfg.steps.SEND_WHATSAPP.enabled && !(await this.alreadyQueued('SEND_WHATSAPP', 'DiscoveryCall', discoveryCallId))) {
      const slots = proposeSlots();
      await this.queue('SEND_WHATSAPP', 'DiscoveryCall', discoveryCallId, `Post-call WhatsApp to ${call.contact.name} (${phone})`,
        { to: phone, contactId: call.contactId, name: call.contact.name, body: this.waBody(call.contact.name, intent), slots: slots.map((s) => ({ iso: s.iso, label: s.label })) },
        intent, cfg.steps.BRAIN.autoApprove);
      actions.push(`whatsapp→${phone}`);
    }

    await this.logs.write({
      type: 'BRAIN', status: 'COMPLETED', entityType: 'DiscoveryCall', entityId: discoveryCallId,
      output: { intent, actions, postCall: true } as object,
      durationMs: Date.now() - started, completedAt: new Date(),
    });
  }

  // ---- understanding ----

  /** AI intent extraction with a deterministic heuristic fallback, so the Brain
   *  still acts (with less nuance) if the AI provider is down/unconfigured. */
  private async extractIntent(text: string, contactName: string): Promise<Intent> {
    if (this.ai.isConfigured()) {
      try {
        const result = await this.ai.chat({
          jsonMode: true, temperature: 0.2,
          messages: [
            { role: 'system', content: INTENT_PROMPT },
            { role: 'user', content: `Guest name: ${contactName}\n\nWhat they wrote/said:\n${text.slice(0, 6000)}` },
          ],
        });
        const parsed = this.ai.parseJson<Partial<Intent>>(result.message.content);
        if (parsed.summary) {
          return {
            need: (['PROGRAM_INFO', 'PRICING', 'BOOKING', 'AVAILABILITY', 'QUESTION', 'OTHER'] as const).includes(parsed.need as Intent['need']) ? (parsed.need as Intent['need']) : 'OTHER',
            programInterest: parsed.programInterest ?? null,
            language: parsed.language ?? null,
            urgency: (['high', 'medium', 'low'] as const).includes(parsed.urgency as Intent['urgency']) ? (parsed.urgency as Intent['urgency']) : 'medium',
            wantsDetails: !!parsed.wantsDetails,
            summary: parsed.summary,
          };
        }
      } catch (e) {
        this.logger.warn(`Intent extraction failed, using heuristics: ${(e as Error).message}`);
      }
    }
    return heuristicIntent(text);
  }

  // ---- composing ----

  private async composeEmail(name: string, intent: Intent, sourceText: string): Promise<{ subject: string; body: string } | null> {
    const kb = await this.knowledge.retrieve(`${intent.programInterest ?? ''} ${intent.need} ${sourceText}`.slice(0, 400), 5).catch(() => []);
    const programs = await this.prisma.program.findMany({
      where: { active: true },
      select: { name: true, durationDays: true, descriptor: true },
      orderBy: { durationDays: 'asc' },
    });
    const programList = programs.map((p) => `- ${p.name}${p.durationDays ? ` (${p.durationDays} days)` : ''}${p.descriptor ? `: ${p.descriptor}` : ''}`).join('\n');

    if (this.ai.isConfigured()) {
      try {
        const result = await this.ai.chat({
          jsonMode: true, temperature: 0.6,
          messages: [
            { role: 'system', content: COMPOSE_PROMPT },
            { role: 'user', content: [
              `Guest name: ${name}`,
              `What Veda understood: ${intent.summary} (need: ${intent.need}${intent.programInterest ? `, interest: ${intent.programInterest}` : ''})`,
              intent.language ? `Write in: ${intent.language}` : '',
              '',
              `OUR PROGRAMS:\n${programList || '- (details on request)'}`,
              kb.length ? `\nKNOWLEDGE (ground every claim in this):\n${kb.map((k) => `• ${k.title}: ${k.content}`).join('\n')}` : '',
              '',
              `What they originally wrote/said:\n${sourceText.slice(0, 2000)}`,
            ].filter(Boolean).join('\n') },
          ],
        });
        const draft = this.ai.parseJson<{ subject?: string; body?: string }>(result.message.content);
        if (draft.subject && draft.body) return { subject: draft.subject, body: draft.body };
      } catch (e) {
        this.logger.warn(`Email compose failed, using fallback: ${(e as Error).message}`);
      }
    }

    // Deterministic fallback — programs + top knowledge, no AI needed.
    const kbBlock = kb.slice(0, 3).map((k) => `${k.title}\n${k.content}`).join('\n\n');
    return {
      subject: `Shreevan Wellness — ${intent.programInterest ?? 'your enquiry'}`,
      body: [
        `Namaste ${name.split(' ')[0]},`,
        '',
        `Thank you for reaching out to Shreevan Wellness. Here is what you asked about:`,
        '',
        programList ? `Our programs:\n${programList}` : '',
        kbBlock,
        '',
        'If you would like, reply to this email and I will arrange a short discovery call to help you choose what fits best.',
        '',
        'Warm regards,',
        'Veda · Shreevan Wellness',
      ].filter((l) => l !== null).join('\n'),
    };
  }

  private waBody(name: string, intent: Intent): string {
    const first = name.trim().split(/\s+/)[0] || 'there';
    const interest = intent.programInterest ? ` about ${intent.programInterest}` : '';
    return `Namaste ${first} 🌿 This is Veda from Shreevan Wellness — thank you for reaching out${interest}. I've sent the details you asked for. Would a short discovery call help? Pick a time below, or just reply here.`;
  }

  // ---- acting ----

  /** True if a same-type action for this entity was already queued/sent recently
   *  (by the Brain, the chat tool, or the qualifier chain) — never double-message. */
  private async alreadyQueued(type: string, entityType: string, entityId: string): Promise<boolean> {
    const existing = await this.prisma.vedaApproval.findFirst({
      where: {
        type, entityType, entityId,
        status: { in: ['PENDING', 'APPROVED', 'AUTO_SENT'] },
        createdAt: { gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
      },
      select: { id: true },
    });
    return !!existing;
  }

  private async queue(
    type: 'SEND_EMAIL' | 'SEND_WHATSAPP',
    entityType: string,
    entityId: string,
    draftText: string,
    payload: object,
    intent: Intent,
    autoApprove: boolean,
  ): Promise<void> {
    const approval = await this.approvals.create({
      type, entityType, entityId, draftText, payload,
      context: { reasoning: `Brain: ${intent.summary}`, need: intent.need, language: intent.language ?? 'auto' },
      expiresInHours: 72,
    });
    if (autoApprove) {
      await this.approvals.approve(approval.id, 'veda-brain', 'Auto-approved: Veda Brain autonomy');
    }
  }
}

/** No-AI fallback: regex-level understanding so the pipeline still works. */
export function heuristicIntent(text: string): Intent {
  const t = text.toLowerCase();
  const programInterest =
    /\b60[\s-]?day/.test(t) ? '60-Day Integration Masterclass'
    : /\b28[\s-]?day/.test(t) || t.includes('reset') ? '28-Day Personal Reset'
    : /\b14[\s-]?day/.test(t) ? '14-Day Foundations Program'
    : /\b7[\s-]?day/.test(t) ? '7-Day Retreat'
    : null;
  const wantsDetails = /\b(detail|details|brochure|info|information|pricing|price|cost|share|send|bhej|jankari|jaankari)\b/.test(t) || /new lead from/i.test(text);
  const need: Intent['need'] =
    /\b(price|pricing|cost|fee|kitna|kitne)\b/.test(t) ? 'PRICING'
    : /\b(book|booking|reserve|confirm)\b/.test(t) ? 'BOOKING'
    : /\b(available|availability|dates|slot|kab)\b/.test(t) ? 'AVAILABILITY'
    : programInterest || wantsDetails ? 'PROGRAM_INFO'
    : 'OTHER';
  const language = /[ऀ-ॿ]/.test(text) ? 'Hindi' : /\b(hai|nahi|chahiye|kitna|bhej|karna|krna)\b/.test(t) ? 'Hinglish' : 'English';
  return {
    need, programInterest, language, urgency: 'medium', wantsDetails,
    summary: `Lead${programInterest ? ` interested in ${programInterest}` : ''} — ${need === 'OTHER' ? 'general enquiry' : need.toLowerCase().replace('_', ' ')}.`,
  };
}
