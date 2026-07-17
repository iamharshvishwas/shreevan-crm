import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Channel, MessageDirection } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { OpenAiProvider } from '../ai/openai.provider';
import { VedaApprovalService } from '../veda-approval.service';
import { VedaConfigService } from '../veda-config.service';
import { VedaLogService } from '../veda-log.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { proposeSlots, formatIst, CALLBACK_MARKER } from '../channels/slots.util';

/** How Veda understood an inbound lead — extracted by AI, heuristics as fallback. */
export interface Intent {
  need: 'PROGRAM_INFO' | 'PRICING' | 'BOOKING' | 'AVAILABILITY' | 'QUESTION' | 'OTHER';
  programInterest: string | null;
  language: string | null;
  urgency: 'high' | 'medium' | 'low';
  wantsDetails: boolean;
  /** Guest asked to be CALLED on their phone (now or at a time they gave). */
  callbackRequested: boolean;
  /** ISO time they asked to be called at; null = now / unspecified. */
  callbackAtIso: string | null;
  summary: string;
}

const LOOKBACK_DAYS = 3;
const BATCH_PER_TICK = 5;
const DEDUPE_WINDOW_MS = 48 * 3600_000;

// Same sanity check the voice scheduler applies before dialing.
const E164 = /^\+[1-9]\d{7,14}$/;

const INTENT_PROMPT = `You are Veda, the AI relationship agent for Shreevan Wellness, a premium Indian wellness-retreat business.

Read what a prospective guest wrote (a chat/WhatsApp/email message, an ad-form submission, or a phone-call transcript) and extract what they actually NEED.

RULES:
- NEVER record any medical or health details. Only general program interest.
- need: PROGRAM_INFO (wants details of a program/retreat), PRICING, BOOKING (wants to book/reserve), AVAILABILITY (dates/slots), QUESTION (a specific question), OTHER.
- programInterest: the program they mean (e.g. "7-Day Retreat", "28-Day Personal Reset"), or null.
- language: "Hindi", "English", or "Hinglish" — how they write/speak.
- urgency: high / medium / low from timeline signals.
- wantsDetails: true if they asked to be SENT details/brochure/pricing/info (on any channel), or if this is an ad/form lead expressing interest in a program.
- callbackRequested: true ONLY if they asked to be CALLED on their phone (e.g. "call me", "mujhe call karo", "call me at 4pm tomorrow"). A discovery-call INVITE from us does not count.
- callbackAtIso: if they gave a specific time for the call, resolve it against the current date-time provided and return an ISO 8601 timestamp WITH the +05:30 offset (assume IST unless they clearly state another timezone). If they want the call now / gave no time, return null. Never return a past time.
- summary: 1-2 plain sentences for the team: who wants what.

Respond ONLY with JSON: { "need", "programInterest", "language", "urgency", "wantsDetails", "callbackRequested", "callbackAtIso", "summary" }.`;

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
        contact: { include: {
          identities: true,
          leads: { where: { confirmedAt: null, closedLostAt: null }, orderBy: { updatedAt: 'desc' }, take: 1 },
        } },
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

    // Decide + queue outreach.
    const email = enquiry.contact.identities.find((i) => i.channel === Channel.EMAIL)?.handle ?? null;
    const phone = enquiry.contact.identities.find((i) => i.channel === Channel.WHATSAPP)?.handle ?? null;
    const cfg = await this.config.get();
    const actions: string[] = [];

    // "Call me (now | at <time>)" — book the call FIRST so the note and the
    // WhatsApp confirmation below can tell the guest the truth about it.
    const callbackAt = await this.scheduleCallback(enquiry.contactId, phone, enquiry.contact.leads[0]?.id ?? null, intent);
    if (callbackAt) actions.push(`callback@${callbackAt.toISOString()}`);

    await this.prisma.internalNote.create({
      data: {
        enquiryId,
        authorName: 'Veda',
        body: `🧠 ${intent.summary} · Need: ${intent.need} · Urgency: ${intent.urgency}${intent.programInterest ? ` · Interest: ${intent.programInterest}` : ''}${callbackAt ? ` · 📞 Callback booked: ${formatIst(callbackAt.toISOString())}` : ''}`,
      },
    }).catch(() => undefined);

    const wantEmail = email && cfg.steps.SEND_EMAIL.enabled
      && (!conversationalReplyHandled || (intent.wantsDetails && enquiry.channel !== Channel.EMAIL));
    const wantWa = phone && cfg.steps.SEND_WHATSAPP.enabled
      && (!conversationalReplyHandled || callbackAt || (intent.wantsDetails && enquiry.channel !== Channel.WHATSAPP));

    let emailQueued = false;
    if (wantEmail && !(await this.alreadyQueued('SEND_EMAIL', 'Enquiry', enquiryId))) {
      const draft = await this.composeEmail(enquiry.contact.name, intent, sourceText);
      if (draft) {
        await this.queue('SEND_EMAIL', 'Enquiry', enquiryId, `Email to ${enquiry.contact.name} <${email}> — "${draft.subject}"`,
          { to: email, subject: draft.subject, body: draft.body }, intent, cfg.steps.BRAIN.autoApprove);
        actions.push(`email→${email}`);
        emailQueued = true;
      }
    }

    if (wantWa && !(await this.alreadyQueued('SEND_WHATSAPP', 'Enquiry', enquiryId))) {
      // Body is used inside the 24h window; outside it the executor sends the
      // pre-approved greeting template automatically. Slot buttons ride along
      // in-window so the guest can book a discovery call in one tap — skipped
      // when a callback is already booked (one clear next step, not two).
      const slots = callbackAt ? [] : proposeSlots();
      const waBody = this.waBody(enquiry.contact.name, intent, { emailQueued, callbackAt });
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
      include: { contact: { include: {
        identities: true,
        leads: { where: { confirmedAt: null, closedLostAt: null }, orderBy: { updatedAt: 'desc' }, take: 1 },
      } } },
    });
    if (!call?.contact) return;

    const sourceText = [call.summary, call.transcriptRedacted].filter(Boolean).join('\n\n').slice(0, 6000);
    if (!sourceText.trim()) return;

    const intent = await this.extractIntent(sourceText, call.contact.name);
    const email = call.contact.identities.find((i) => i.channel === Channel.EMAIL)?.handle ?? null;
    const phone = call.contact.identities.find((i) => i.channel === Channel.WHATSAPP)?.handle
      ?? call.contact.identities.find((i) => i.channel === Channel.PHONE)?.handle ?? null;
    const cfg = await this.config.get();
    const actions: string[] = [];

    // Caller asked (during the call) to be called again at a specific time.
    const callbackAt = await this.scheduleCallback(call.contactId!, phone, call.contact.leads[0]?.id ?? null, intent);
    if (callbackAt) actions.push(`callback@${callbackAt.toISOString()}`);

    if (email && cfg.steps.SEND_EMAIL.enabled && !(await this.alreadyQueued('SEND_EMAIL', 'DiscoveryCall', discoveryCallId))) {
      const draft = await this.composeEmail(call.contact.name, intent, `They just finished a phone call with Veda. Call summary/transcript:\n${sourceText}`);
      if (draft) {
        await this.queue('SEND_EMAIL', 'DiscoveryCall', discoveryCallId, `Post-call email to ${call.contact.name} <${email}> — "${draft.subject}"`,
          { to: email, subject: draft.subject, body: draft.body }, intent, cfg.steps.BRAIN.autoApprove);
        actions.push(`email→${email}`);
      }
    }
    if (phone && cfg.steps.SEND_WHATSAPP.enabled && !(await this.alreadyQueued('SEND_WHATSAPP', 'DiscoveryCall', discoveryCallId))) {
      const slots = callbackAt ? [] : proposeSlots();
      await this.queue('SEND_WHATSAPP', 'DiscoveryCall', discoveryCallId, `Post-call WhatsApp to ${call.contact.name} (${phone})`,
        { to: phone, contactId: call.contactId, name: call.contact.name, body: this.waBody(call.contact.name, intent, { emailQueued: actions.some((a) => a.startsWith('email')), callbackAt }), slots: slots.map((s) => ({ iso: s.iso, label: s.label })) },
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
            { role: 'user', content: `Current date-time: ${new Date().toISOString()} (IST: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })})\nGuest name: ${contactName}\n\nWhat they wrote/said:\n${text.slice(0, 6000)}` },
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
            callbackRequested: !!parsed.callbackRequested,
            callbackAtIso: typeof parsed.callbackAtIso === 'string' && !isNaN(new Date(parsed.callbackAtIso).getTime()) ? parsed.callbackAtIso : null,
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

  /** Truthful WhatsApp body — only claims what actually got queued/booked. */
  private waBody(name: string, intent: Intent, opts: { emailQueued: boolean; callbackAt: Date | null }): string {
    const first = name.trim().split(/\s+/)[0] || 'there';
    const interest = intent.programInterest ? ` about ${intent.programInterest}` : '';
    const parts = [`Namaste ${first} 🌿 This is Veda from Shreevan Wellness — thank you for reaching out${interest}.`];
    if (opts.callbackAt) parts.push(`Your call is booked — I'll ring you around ${formatIst(opts.callbackAt.toISOString())}.`);
    if (opts.emailQueued) parts.push(`I've emailed you the details you asked for.`);
    if (!opts.callbackAt) parts.push(`Would a short discovery call help? Pick a time below, or just reply here.`);
    return parts.join(' ');
  }

  /**
   * "Call me (now | at <time>)" → create the DiscoveryCall Veda must remember.
   * The voice scheduler dials it when due (even without a Lead — the guest's
   * explicit request is the business reason); a "now" during quiet hours is
   * deferred to the first minute after they end so nobody's phone rings at 2am.
   * Returns the booked time, or null when nothing was booked.
   */
  private async scheduleCallback(contactId: string, phone: string | null, leadId: string | null, intent: Intent): Promise<Date | null> {
    if (!intent.callbackRequested || !phone) return null;
    const clean = phone.replace(/\s|-/g, '');
    if (!E164.test(clean)) return null;

    // One open callback per contact — asking twice must not book two calls.
    const open = await this.prisma.discoveryCall.findFirst({
      where: { contactId, status: 'SCHEDULED', prepNotes: { contains: CALLBACK_MARKER } },
      select: { id: true },
    });
    if (open) return null;

    const cfg = await this.config.get();
    let at = intent.callbackAtIso ? new Date(intent.callbackAtIso) : new Date();
    if (isNaN(at.getTime()) || at.getTime() < Date.now() - 5 * 60_000) at = new Date();
    if (!intent.callbackAtIso) at = deferOutOfQuietHours(at, cfg.quietHoursStart, cfg.quietHoursEnd, cfg.quietHoursTimezone);

    await this.prisma.discoveryCall.create({
      data: {
        contactId, leadId, scheduledAt: at, timezone: cfg.quietHoursTimezone, status: 'SCHEDULED',
        prepNotes: `${CALLBACK_MARKER} — ${intent.callbackAtIso ? `asked for ${formatIst(at.toISOString())}` : 'asked to be called now'}. ${intent.summary}`.slice(0, 500),
      },
    });
    return at;
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

/** If `at` falls inside quiet hours, push it to the first minute after they
 *  end (timezone-aware via Intl, no date-construction in the target tz). */
export function deferOutOfQuietHours(at: Date, startHHMM: string, endHHMM: string, tz: string): Date {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
    const cur = fmt.format(at); // "HH:MM"
    const inQuiet = startHHMM <= endHHMM ? cur >= startHHMM && cur < endHHMM : cur >= startHHMM || cur < endHHMM;
    if (!inQuiet) return at;
    const [ch, cm] = cur.split(':').map(Number);
    const [eh, em] = endHHMM.split(':').map(Number);
    let diffMin = eh * 60 + em - (ch * 60 + cm);
    if (diffMin <= 0) diffMin += 24 * 60;
    return new Date(at.getTime() + diffMin * 60_000);
  } catch {
    return at;
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
  // "call me / call karo / phone karo / callback" — without AI we can't parse a
  // requested time reliably, so heuristic callbacks are treated as "call now".
  const callbackRequested = /\b(call me|call back|callback|ring me)\b/.test(t) || /(call|phone)\s*(kar|krd|kijiye|karna|karo|krna)/.test(t) || /(mujhe|muje)\s+(call|phone)/.test(t);
  return {
    need, programInterest, language, urgency: 'medium', wantsDetails,
    callbackRequested, callbackAtIso: null,
    summary: `Lead${programInterest ? ` interested in ${programInterest}` : ''} — ${need === 'OTHER' ? 'general enquiry' : need.toLowerCase().replace('_', ' ')}.`,
  };
}
