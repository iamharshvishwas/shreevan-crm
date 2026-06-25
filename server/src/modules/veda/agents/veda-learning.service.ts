import { Injectable, Logger } from '@nestjs/common';
import { VedaGapStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { OpenAiProvider } from '../ai/openai.provider';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { VedaConfigService } from '../veda-config.service';
import { VedaLogService } from '../veda-log.service';

/** Categories safe to auto-apply. Anything else is gated for human approval. */
const SAFE_CATEGORIES = new Set(['FAQ', 'About', 'Stay & Travel', 'Experience', 'Programs']);
/** Even in a "safe" category, these words force human approval (money/health/legal). */
const SENSITIVE_RX = /\b(price|pricing|cost|fee|fees|refund|cancel|deposit|discount|usd|gbp|cad|eur|inr|\$|₹|medical|health|cure|treat|diagnos|therapy|medication|disease|legal|tax|visa|liabilit)\w*/i;
/** Phrases that signal Veda did not actually answer (so it is a knowledge gap). */
const DEFERRAL_RX = /(team\s+(will\s+)?(confirm|follow\s*up|get back|reach out)|have the team|let the team|share (this )?with (the|our) team|don'?t have|do not have|not sure|cannot confirm|can'?t confirm|will (have to )?check|टीम|पता नहीं|जानकारी नहीं|confirm karega|team se)/i;

export interface GapSignal {
  question: string;
  vedaReply: string;
  kbHitCount: number;
  conversationId?: string | null;
  channel?: string | null;
}

@Injectable()
export class VedaLearningService {
  private readonly logger = new Logger(VedaLearningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: OpenAiProvider,
    private readonly knowledge: KnowledgeService,
    private readonly config: VedaConfigService,
    private readonly log: VedaLogService,
  ) {}

  /**
   * Called after every Veda reply. If Veda clearly could not answer (deferred,
   * or no knowledge matched a real question), record/strengthen a gap. Cheap and
   * fire-and-forget — never blocks or breaks the reply.
   */
  async observe(sig: GapSignal): Promise<void> {
    try {
      if (!(await this.config.isStepEnabled('SELF_LEARN'))) return;
      const q = (sig.question ?? '').trim();
      if (q.length < 8) return; // ignore greetings / one-word messages
      const looksLikeQuestion = q.includes('?') || /\b(what|how|when|where|which|do you|can i|is there|price|cost|kya|kaise|kitna|kab|kahan)\b/i.test(q);
      const missed = DEFERRAL_RX.test(sig.vedaReply) || (sig.kbHitCount === 0 && looksLikeQuestion);
      if (!missed) return;

      const normalized = normalize(q);
      if (!normalized) return;
      const existing = await this.prisma.vedaKnowledgeGap.findFirst({
        where: { normalized, status: { in: [VedaGapStatus.OPEN, VedaGapStatus.ANSWERED, VedaGapStatus.PENDING] } },
        orderBy: { createdAt: 'desc' },
      });
      if (existing) {
        await this.prisma.vedaKnowledgeGap.update({ where: { id: existing.id }, data: { occurrences: { increment: 1 } } });
        return;
      }
      await this.prisma.vedaKnowledgeGap.create({
        data: { question: q.slice(0, 500), normalized, channel: sig.channel ?? null, conversationId: sig.conversationId ?? null },
      });
    } catch (e) {
      this.logger.warn(`observe failed: ${(e as Error).message}`);
    }
  }

  /**
   * Called when a human replies in a conversation. Attaches that reply as the
   * answer to the most recent unanswered gap in the same conversation, so Veda
   * can learn the answer it was missing.
   */
  async captureAnswer(conversationId: string, answer: string): Promise<void> {
    try {
      const text = (answer ?? '').trim();
      if (text.length < 12 || !conversationId) return;
      const gap = await this.prisma.vedaKnowledgeGap.findFirst({
        where: { conversationId, status: VedaGapStatus.OPEN },
        orderBy: { createdAt: 'desc' },
      });
      if (!gap) return;
      await this.prisma.vedaKnowledgeGap.update({
        where: { id: gap.id },
        data: { capturedAnswer: text.slice(0, 2000), status: VedaGapStatus.ANSWERED },
      });
    } catch (e) {
      this.logger.warn(`captureAnswer failed: ${(e as Error).message}`);
    }
  }

  /**
   * Cron worker: turn answered gaps into knowledge. Drafts a clean entry from
   * the captured answer (grounded only in that answer), then either auto-applies
   * it (safe category + autoApprove) or queues it for one-click approval.
   */
  async draftAnswered(): Promise<{ drafted: number; applied: number; queued: number }> {
    const cfg = await this.config.get();
    const autoApprove = cfg.steps.SELF_LEARN?.autoApprove ?? false;
    const gaps = await this.prisma.vedaKnowledgeGap.findMany({
      where: { status: VedaGapStatus.ANSWERED, capturedAnswer: { not: null } },
      orderBy: { occurrences: 'desc' },
      take: 10,
    });
    let drafted = 0, applied = 0, queued = 0;
    for (const g of gaps) {
      const draft = await this.draftEntry(g.question, g.capturedAnswer ?? '');
      if (!draft) continue;
      drafted++;
      const sensitive = !SAFE_CATEGORIES.has(draft.category) || SENSITIVE_RX.test(`${draft.title} ${draft.content}`);
      if (autoApprove && !sensitive) {
        const created = await this.knowledge.create({ title: draft.title, content: draft.content, category: draft.category, tags: ['learned'] });
        await this.prisma.vedaKnowledgeGap.update({
          where: { id: g.id },
          data: { status: VedaGapStatus.APPLIED, draftTitle: draft.title, draftContent: draft.content, draftCategory: draft.category, knowledgeId: created.id, resolvedAt: new Date() },
        });
        applied++;
        await this.log.write({ type: 'SELF_LEARN', status: 'COMPLETED', entityType: 'VedaKnowledge', entityId: created.id, completedAt: new Date() }).catch(() => undefined);
      } else {
        await this.prisma.vedaKnowledgeGap.update({
          where: { id: g.id },
          data: { status: VedaGapStatus.PENDING, draftTitle: draft.title, draftContent: draft.content, draftCategory: draft.category },
        });
        queued++;
      }
    }
    if (drafted) this.logger.log(`Self-learning: ${drafted} drafted, ${applied} auto-applied, ${queued} queued for approval.`);
    return { drafted, applied, queued };
  }

  /** Approve a queued draft → add it to the knowledge base. */
  async approve(id: string, userId?: string): Promise<{ ok: boolean; knowledgeId?: string }> {
    const g = await this.prisma.vedaKnowledgeGap.findUnique({ where: { id } });
    if (!g || g.status !== VedaGapStatus.PENDING || !g.draftTitle || !g.draftContent) return { ok: false };
    const created = await this.knowledge.create({ title: g.draftTitle, content: g.draftContent, category: g.draftCategory ?? 'FAQ', tags: ['learned'] });
    await this.prisma.vedaKnowledgeGap.update({
      where: { id }, data: { status: VedaGapStatus.APPLIED, knowledgeId: created.id, reviewedBy: userId ?? null, resolvedAt: new Date() },
    });
    return { ok: true, knowledgeId: created.id };
  }

  async dismiss(id: string, userId?: string): Promise<{ ok: boolean }> {
    await this.prisma.vedaKnowledgeGap.update({
      where: { id }, data: { status: VedaGapStatus.DISMISSED, reviewedBy: userId ?? null, resolvedAt: new Date() },
    }).catch(() => undefined);
    return { ok: true };
  }

  async list(status?: string) {
    const where = status ? { status: status as VedaGapStatus } : {};
    return this.prisma.vedaKnowledgeGap.findMany({ where, orderBy: [{ status: 'asc' }, { occurrences: 'desc' }, { createdAt: 'desc' }], take: 100 });
  }

  async stats() {
    const [open, answered, pending, applied] = await Promise.all([
      this.prisma.vedaKnowledgeGap.count({ where: { status: VedaGapStatus.OPEN } }),
      this.prisma.vedaKnowledgeGap.count({ where: { status: VedaGapStatus.ANSWERED } }),
      this.prisma.vedaKnowledgeGap.count({ where: { status: VedaGapStatus.PENDING } }),
      this.prisma.vedaKnowledgeGap.count({ where: { status: VedaGapStatus.APPLIED } }),
    ]);
    return { open, answered, pending, applied };
  }

  /** LLM drafts a reusable KB entry strictly from the captured answer. */
  private async draftEntry(question: string, answer: string): Promise<{ title: string; content: string; category: string } | null> {
    const fallback = { title: question.replace(/\s+/g, ' ').trim().slice(0, 80), content: answer.trim(), category: 'FAQ' };
    if (!answer.trim()) return null;
    if (!this.ai.isConfigured()) return fallback;
    try {
      const sys = 'You improve a wellness retreat knowledge base. Given a visitor question and the team\'s real answer, write a concise reusable knowledge entry. Use ONLY facts present in the team answer — never invent prices, policies, medical claims, or details. Classify into exactly one category from: FAQ, Programs, Pricing, Policies, Booking & Payment, Stay & Travel, About. Respond ONLY with compact JSON: {"title": string, "content": string, "category": string}.';
      const user = `Question: ${question}\n\nTeam answer: ${answer}`;
      const res = await this.ai.chat({ temperature: 0.2, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }] });
      const raw = (res.message.content ?? '').trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(raw) as { title?: string; content?: string; category?: string };
      if (!parsed.title || !parsed.content) return fallback;
      return { title: parsed.title.slice(0, 120), content: parsed.content.slice(0, 1500), category: parsed.category || 'FAQ' };
    } catch {
      return fallback;
    }
  }
}

/** Lowercase, strip punctuation, collapse whitespace — for gap de-duplication. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
}
