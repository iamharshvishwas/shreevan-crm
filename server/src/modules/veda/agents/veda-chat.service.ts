import { Injectable, Logger } from '@nestjs/common';
import { DeliveryState, MessageDirection } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { OpenAiProvider, type ChatMessage } from '../ai/openai.provider';
import { VedaConfigService } from '../veda-config.service';
import { VedaLogService } from '../veda-log.service';
import { KnowledgeService } from '../knowledge/knowledge.service';

const HISTORY_LIMIT = 16;

@Injectable()
export class VedaChatService {
  private readonly logger = new Logger(VedaChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: OpenAiProvider,
    private readonly config: VedaConfigService,
    private readonly logs: VedaLogService,
    private readonly knowledge: KnowledgeService,
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
        contact: true,
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
      const system = await this.systemPrompt(conversation.contact?.name, conversation.channel, kb);
      const history: ChatMessage[] = ordered.map((m) => ({
        role: m.direction === MessageDirection.INBOUND ? 'user' : 'assistant',
        content: m.body,
      }));

      const result = await this.ai.chat({
        temperature: 0.6,
        messages: [{ role: 'system', content: system }, ...history],
      });
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

      await this.logs.write({
        type: 'CHAT_REPLY', status: 'COMPLETED', entityType: 'Conversation', entityId: conversationId,
        output: { channel: conversation.channel } as object,
        costUsdMicro: result.costUsdMicro, durationMs: Date.now() - started, completedAt: new Date(),
      });

      return { reply };
    } catch (e) {
      await this.logs.write({
        type: 'CHAT_REPLY', status: 'FAILED', entityType: 'Conversation', entityId: conversationId,
        error: (e as Error).message, durationMs: Date.now() - started,
      });
      return { reply: null };
    }
  }

  private async systemPrompt(
    contactName?: string | null,
    channel?: string,
    knowledge: { title: string; content: string }[] = [],
  ): Promise<string> {
    const isEmail = channel === 'EMAIL';
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

STYLE:
- Reply in the guest's language — Hindi, English, or Hinglish — matching how they write.
- Calm, warm, premium. ${isEmail
      ? 'This is an EMAIL reply: write 2-3 short paragraphs, greet by name if known, and sign off as "Warm regards,\\nVeda · Shreevan Wellness". Do not include a subject line.'
      : 'This is a live chat, so keep replies short (1-4 sentences). A light 🌿 occasionally is fine.'}

STRICT RULES:
- NEVER ask about, discuss, or store medical or health conditions, diagnoses, symptoms, or medications. If they raise health details, gently say our wellness team handles that privately and confidentially after they connect with us, then steer back.
- Don't quote exact prices unless asked; if asked, you may share program pricing ranges, but encourage a call for a tailored recommendation.
- Never make medical or outcome promises. Be honest if you don't know something and offer to have the team follow up.${kbBlock}`;
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
