import { Injectable, Logger } from '@nestjs/common';
import { Channel, DeliveryState, MessageDirection } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { OpenAiProvider, type ChatMessage, type ToolDef } from '../ai/openai.provider';
import { VedaConfigService } from '../veda-config.service';
import { VedaLogService } from '../veda-log.service';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { VedaLearningService } from './veda-learning.service';
import { EmailDrafterService } from './email-drafter.service';
import { WhatsAppDrafterService } from './whatsapp-drafter.service';
import { VEDA_OPERATING_RULES } from '../veda-operating-rules';

const HISTORY_LIMIT = 16;

const CHAT_TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'queue_program_details',
      description: 'Queue sending the guest program details (name, duration, pricing) by email or WhatsApp, for a team member to review and send. Call this ONLY when the guest explicitly asks you to send/share details to their email or WhatsApp/number, and you already have that contact on file.',
      parameters: {
        type: 'object',
        properties: {
          channel: { type: 'string', enum: ['EMAIL', 'WHATSAPP'], description: 'Which channel the guest asked for.' },
        },
        required: ['channel'],
      },
    },
  },
];

@Injectable()
export class VedaChatService {
  private readonly logger = new Logger(VedaChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: OpenAiProvider,
    private readonly config: VedaConfigService,
    private readonly logs: VedaLogService,
    private readonly knowledge: KnowledgeService,
    private readonly learning: VedaLearningService,
    private readonly emailDrafter: EmailDrafterService,
    private readonly whatsappDrafter: WhatsAppDrafterService,
  ) {}

  /**
   * Generate Veda's reply for a conversation and record it as an outbound
   * message. Returns the reply text (caller delivers it — web returns it to the
   * widget, WhatsApp sends it). Returns null when chat replies are disabled.
   */
  async respond(conversationId: string): Promise<{ reply: string | null }> {
    const started = Date.now();

    if (!this.ai.isConfigured()) return { reply: null };
    if (!(await this.config.isGloballyEnabled())) return { reply: null };
    if (!(await this.config.isStepEnabled('CHAT_REPLY'))) return { reply: null };

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: { include: { identities: true } },
        messages: { orderBy: { occurredAt: 'desc' }, take: HISTORY_LIMIT },
      },
    });
    if (!conversation) return { reply: null };

    // A human has taken over this chat — Veda stays silent here.
    if (conversation.handoverToHuman) return { reply: null };

    // Don't reply if the most recent message is already from us (avoid loops).
    const ordered = [...conversation.messages].reverse();
    const last = ordered[ordered.length - 1];
    if (last && last.direction === MessageDirection.OUTBOUND) return { reply: null };

    try {
      const kb = await this.knowledge.retrieve(last?.body ?? '', 5).catch(() => []);
      const system = await this.systemPrompt(conversation.contact?.name, conversation.contact?.identities, conversation.channel, kb);
      const history: ChatMessage[] = ordered.map((m) => ({
        role: m.direction === MessageDirection.INBOUND ? 'user' : 'assistant',
        content: m.body,
      }));
      const messages: ChatMessage[] = [{ role: 'system', content: system }, ...history];

      let result = await this.ai.chat({ temperature: 0.6, messages, tools: CHAT_TOOLS });
      let totalCost = result.costUsdMicro;

      // If Veda asked to queue a send, run it, feed the (truthful) outcome back,
      // and let it compose the actual reply on a second pass — so it never
      // claims something happened that didn't.
      if (result.message.tool_calls?.length) {
        messages.push(result.message);
        for (const call of result.message.tool_calls) {
          const output = await this.runChatTool(call.function.name, call.function.arguments, conversation.enquiryId);
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(output) });
        }
        result = await this.ai.chat({ temperature: 0.6, messages });
        totalCost += result.costUsdMicro;
      }

      const reply = (result.message.content ?? '').trim();
      if (!reply) return { reply: null };

      await this.prisma.message.create({
        data: {
          conversationId,
          direction: MessageDirection.OUTBOUND,
          channel: conversation.channel,
          authorName: 'Veda',
          body: reply,
          delivery: DeliveryState.SENT,
          occurredAt: new Date(),
        },
      });
      // Touch the conversation + raise a hand if Veda seems unsure or the client wants a human.
      const attention = detectAttention(last?.body ?? '', reply);
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date(), ...(attention ? { needsAttention: true, attentionReason: attention } : {}) },
      });
      // Veda answered the guest, so the first-response SLA clock stops — but the
      // enquiry deliberately stays NEEDS_REPLY: a human still hasn't triaged it.
      if (conversation.enquiryId) {
        await this.prisma.enquiry.updateMany({
          where: { id: conversation.enquiryId, firstRespondedAt: null },
          data: { firstRespondedAt: new Date() },
        });
      }

      await this.logs.write({
        type: 'CHAT_REPLY', status: 'COMPLETED', entityType: 'Conversation', entityId: conversationId,
        output: { channel: conversation.channel } as object,
        costUsdMicro: totalCost, durationMs: Date.now() - started, completedAt: new Date(),
      });

      // Self-learning: note questions Veda could not confidently answer.
      void this.learning.observe({ question: last?.body ?? '', vedaReply: reply, kbHitCount: kb.length, conversationId, channel: conversation.channel });

      return { reply };
    } catch (e) {
      await this.logs.write({
        type: 'CHAT_REPLY', status: 'FAILED', entityType: 'Conversation', entityId: conversationId,
        error: (e as Error).message, durationMs: Date.now() - started,
      });
      return { reply: null };
    }
  }

  /** Executes a tool Veda called mid-chat. Respects the same admin on/off
   *  switches (Settings → Veda) that gate the Lead nurture drafters. */
  private async runChatTool(name: string, rawArgs: string, enquiryId: string | null): Promise<{ queued: boolean; reason?: string }> {
    if (name !== 'queue_program_details') return { queued: false, reason: `Unknown tool ${name}` };
    if (!enquiryId) return { queued: false, reason: 'No enquiry on this conversation yet.' };

    const args = safeParseJson(rawArgs);
    const channel = args.channel === 'WHATSAPP' ? 'WHATSAPP' : 'EMAIL';

    if (channel === 'EMAIL') {
      if (!(await this.config.isStepEnabled('SEND_EMAIL'))) return { queued: false, reason: 'Email sending is currently turned off by the team.' };
      return this.emailDrafter.draftForEnquiry(enquiryId);
    }
    if (!(await this.config.isStepEnabled('SEND_WHATSAPP'))) return { queued: false, reason: 'WhatsApp sending is currently turned off by the team.' };
    return this.whatsappDrafter.draftForEnquiry(enquiryId);
  }

  private async systemPrompt(
    contactName?: string | null,
    identities?: { channel: Channel; handle: string }[],
    channel?: string,
    knowledge: { title: string; content: string }[] = [],
  ): Promise<string> {
    const isEmail = channel === 'EMAIL';
    const knownEmail = identities?.find((i) => i.channel === Channel.EMAIL)?.handle;
    const knownPhone = identities?.find((i) => i.channel === Channel.WHATSAPP)?.handle;
    const knownDetailsBlock = knownEmail || knownPhone
      ? `\n\nDETAILS ALREADY ON FILE for this guest — do NOT ask for these again, and use them (don't just say you "will pass it to the team", actually reference them) when confirming a follow-up: ${[knownEmail && `email ${knownEmail}`, knownPhone && `WhatsApp ${knownPhone}`].filter(Boolean).join(', ')}.`
      : '';
    const kbBlock = knowledge.length
      ? `\n\nRELEVANT KNOWLEDGE (use this to answer accurately; if it doesn't cover the question, say you'll have the team confirm):\n${knowledge.map((k) => `• ${k.title}: ${k.content}`).join('\n')}`
      : '';
    const programs = await this.prisma.program.findMany({
      where: { active: true },
      select: { name: true, durationDays: true, descriptor: true },
      orderBy: { durationDays: 'asc' },
    });
    const programList = programs.length
      ? programs.map((p) => `- ${p.name}${p.durationDays ? ` (${p.durationDays} days)` : ''}${p.descriptor ? `: ${p.descriptor}` : ''}`).join('\n')
      : '- (program details available on request)';

    return `You are Veda, the AI relationship guide for Shreevan Wellness, a premium Indian wellness-retreat business serving Indian and international guests. You are chatting live with a prospective guest${contactName && contactName !== 'Website visitor' ? ` named ${contactName}` : ''}.

OUR PROGRAMS:
${programList}

YOUR GOAL:
- Warmly welcome them, understand what they're looking for, and answer questions about our retreats at a high level.
- Naturally guide them toward booking a short discovery call with our team. Offer to take their name and a good time/number, or invite them to share it.
- If they ask you to send/share program details on their email or WhatsApp, call the queue_program_details tool (needs that contact on file — check DETAILS ALREADY ON FILE below, or ask for it first if it's missing). Tell them the truth about what the tool reports back — if it queued, say a team member will send it shortly; if it couldn't (e.g. no contact on file), say so plainly instead of claiming it's done.

STYLE:
- Reply in the guest's language — Hindi, English, or Hinglish — matching how they write.
- Calm, warm, premium. ${isEmail
      ? 'This is an EMAIL reply: write 2-3 short paragraphs, greet by name if known, and sign off as "Warm regards,\\nVeda · Shreevan Wellness". Do not include a subject line.'
      : 'This is a live chat, so keep replies short (1-4 sentences). A light 🌿 occasionally is fine.'}

${VEDA_OPERATING_RULES}${knownDetailsBlock}${kbBlock}`;
  }
}

/**
 * Lightweight heuristic to raise a hand for human review:
 *  - the visitor explicitly asks for a person, or
 *  - Veda's reply signals uncertainty / a hand-off to "the team".
 */
function detectAttention(userText: string, vedaReply: string): string | null {
  const u = userText.toLowerCase();
  if (/\b(human|agent|person|representative|real person|someone|insaan|vyakti)\b/.test(u) || /baat kar/.test(u) && /(team|insaan|human)/.test(u)) {
    return 'Client may want to speak to a person';
  }
  const r = vedaReply.toLowerCase();
  if (/(team will|i'?ll have the team|have our team|team se confirm|confirm with the team|get back to you|i'?m not sure|i do not know|i don'?t know|can'?t answer)/.test(r)) {
    return 'Veda was unsure / deferred to the team';
  }
  return null;
}

function safeParseJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
}
