import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { OpenAiProvider } from '../ai/openai.provider';

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
