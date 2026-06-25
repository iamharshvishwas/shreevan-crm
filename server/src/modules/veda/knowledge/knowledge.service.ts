import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { OpenAiProvider } from '../ai/openai.provider';
import { chunkPack, PACK_TAG } from './shreevan-pack';

/** Titles from the retired v1 hand-written pack — pruned on the next seed run. */
const V1_LEGACY_TITLES = [
  'What is Shreevan Wellness', 'Our philosophy, vision and mission', 'Why choose Shreevan Wellness',
  'Who our retreats are for', 'Programs at a glance — which retreat is right for you',
  '3-Day Reset Retreat (Ganga Sattva Reset)', '7-Day Foundation Retreat', '14-Day Transformation Retreat',
  '28-Day Inner Awakening — flagship (Sattva Ganga: 28 Days to Your True Self)', '60-Day Yogic Living Immersion',
  '28-Day daily schedule', '28-Day weekly journey', '28-Day total experience', 'What you will experience',
  'Transformation outcomes', 'Included live and online sessions', 'Program pricing', 'Payment terms',
  'Where we are and how to reach us', 'Do I need prior yoga experience', 'Is the retreat religious',
  'What is sattvic food and can you handle dietary needs', 'Can solo travelers join and what is the group size',
  'What should I bring', 'Is airport pickup available', 'Refund and cancellation policy', 'Transfer policy',
  'Health and wellness disclaimer', 'What happens after you book', 'Consultation and sales process',
];

export interface KnowledgeInput {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  active?: boolean;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: OpenAiProvider,
  ) {}

  async list() {
    return this.prisma.vedaKnowledge.findMany({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, content: true, category: true, tags: true, active: true, updatedAt: true },
    });
  }

  /** One-click: turn the active Programs into knowledge entries (skips duplicates by title). */
  async importPrograms(): Promise<{ created: number }> {
    const programs = await this.prisma.program.findMany({ where: { active: true }, orderBy: { durationDays: 'asc' } });
    let created = 0;
    for (const p of programs) {
      const exists = await this.prisma.vedaKnowledge.findFirst({ where: { title: p.name } });
      if (exists) continue;
      const parts = [
        p.durationDays ? `Duration: ${p.durationDays} days.` : '',
        p.priceInrAmount ? `Price (India): ₹${(p.priceInrAmount / 100).toLocaleString('en-IN')}.` : '',
        p.priceUsdAmount ? `Price (International): $${(p.priceUsdAmount / 100).toLocaleString('en-US')}.` : '',
        p.descriptor ?? '',
      ].filter(Boolean).join(' ');
      await this.create({ title: p.name, category: 'Programs', content: parts || `${p.name} — details on request.` });
      created++;
    }
    return { created };
  }

  /**
   * Load (or refresh) the curated Shreevan Wellness knowledge pack into the RAG
   * store. Upserts by title (new entries created, edited ones re-embedded,
   * unchanged ones skipped) and prunes stale pack entries plus the retired v1
   * pack. Safe to run repeatedly. Manually-added entries are never touched.
   */
  async seedShreevan(): Promise<{ created: number; updated: number; skipped: number; removed: number }> {
    const entries = chunkPack();
    const wanted = new Set(entries.map((e) => e.title));

    // Prune: anything tagged as a pack entry (or from the v1 pack) that the
    // current pack no longer contains.
    const managed = await this.prisma.vedaKnowledge.findMany({
      where: { OR: [{ tags: { has: PACK_TAG } }, { title: { in: V1_LEGACY_TITLES } }] },
      select: { id: true, title: true },
    });
    let removed = 0;
    for (const m of managed) {
      if (!wanted.has(m.title)) { await this.prisma.vedaKnowledge.delete({ where: { id: m.id } }).catch(() => undefined); removed++; }
    }

    let created = 0, updated = 0, skipped = 0;
    for (const e of entries) {
      const existing = await this.prisma.vedaKnowledge.findFirst({ where: { title: e.title } });
      if (!existing) {
        const embedding = await this.embedFor(e);
        await this.prisma.vedaKnowledge.create({
          data: { title: e.title, content: e.content, category: e.category, tags: e.tags, active: true, embedding },
        });
        created++;
        continue;
      }
      const unchanged = existing.content === e.content && existing.category === e.category;
      if (unchanged) {
        if (!existing.tags.includes(PACK_TAG)) {
          await this.prisma.vedaKnowledge.update({ where: { id: existing.id }, data: { tags: e.tags } });
        }
        skipped++;
        continue;
      }
      const embedding = await this.embedFor(e);
      await this.prisma.vedaKnowledge.update({
        where: { id: existing.id },
        data: { content: e.content, category: e.category, tags: e.tags, active: true, ...(embedding.length ? { embedding } : {}) },
      });
      updated++;
    }
    this.logger.log(`Shreevan knowledge seed: ${created} created, ${updated} updated, ${skipped} unchanged, ${removed} pruned.`);
    return { created, updated, skipped, removed };
  }

  async create(input: KnowledgeInput) {
    const embedding = await this.embedFor(input);
    return this.strip(await this.prisma.vedaKnowledge.create({
      data: {
        title: input.title,
        content: input.content,
        category: input.category,
        tags: input.tags ?? [],
        active: input.active ?? true,
        embedding,
      },
    }));
  }

  async update(id: string, input: Partial<KnowledgeInput>) {
    const existing = await this.prisma.vedaKnowledge.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Knowledge entry not found');
    // Re-embed only when the text changed.
    const textChanged = input.title !== undefined || input.content !== undefined;
    const embedding = textChanged
      ? await this.embedFor({ title: input.title ?? existing.title, content: input.content ?? existing.content })
      : undefined;
    return this.strip(await this.prisma.vedaKnowledge.update({
      where: { id },
      data: {
        title: input.title,
        content: input.content,
        category: input.category,
        tags: input.tags,
        active: input.active,
        ...(embedding ? { embedding } : {}),
      },
    }));
  }

  async remove(id: string) {
    await this.prisma.vedaKnowledge.delete({ where: { id } }).catch(() => undefined);
    return { ok: true };
  }

  /**
   * Retrieve the most relevant active entries for a query (RAG). Uses cosine
   * similarity over embeddings when available; falls back to keyword matching.
   */
  async retrieve(query: string, k = 5): Promise<{ title: string; content: string }[]> {
    const entries = await this.prisma.vedaKnowledge.findMany({ where: { active: true } });
    if (!entries.length) return [];

    if (this.ai.isConfigured()) {
      try {
        const q = await this.ai.embed(query);
        const scored = entries
          .filter((e) => e.embedding.length)
          .map((e) => ({ e, score: cosine(q, e.embedding) }))
          .sort((a, b) => b.score - a.score)
          .filter((s) => s.score > 0.15)
          .slice(0, k);
        if (scored.length) return scored.map((s) => ({ title: s.e.title, content: s.e.content }));
      } catch (err) {
        this.logger.warn(`Embedding retrieval failed, using keyword fallback: ${(err as Error).message}`);
      }
    }
    return this.keyword(query, entries, k);
  }

  /** Concise dump of all active knowledge — injected into the voice assistant at call start. */
  async fullContext(maxChars = 3500): Promise<string> {
    const entries = await this.prisma.vedaKnowledge.findMany({ where: { active: true }, orderBy: { updatedAt: 'desc' } });
    let out = '';
    for (const e of entries) {
      const block = `• ${e.title}: ${e.content}\n`;
      if (out.length + block.length > maxChars) break;
      out += block;
    }
    return out.trim();
  }

  private keyword(query: string, entries: { title: string; content: string; tags: string[] }[], k: number) {
    const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    return entries
      .map((e) => {
        const hay = `${e.title} ${e.content} ${e.tags.join(' ')}`.toLowerCase();
        const score = terms.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
        return { e, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((s) => ({ title: s.e.title, content: s.e.content }));
  }

  private async embedFor(input: { title: string; content: string }): Promise<number[]> {
    if (!this.ai.isConfigured()) return [];
    try {
      return await this.ai.embed(`${input.title}\n${input.content}`);
    } catch {
      return [];
    }
  }

  private strip<T extends { embedding?: unknown }>(row: T): Omit<T, 'embedding'> {
    const { embedding, ...rest } = row;
    void embedding;
    return rest;
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
