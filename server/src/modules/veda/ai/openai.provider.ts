import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** OpenAI chat message shape (subset we use). */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatResult {
  message: ChatMessage;
  costUsdMicro: number;
  promptTokens: number;
  completionTokens: number;
  raw: unknown;
}

// gpt-4o-mini pricing (USD per 1M tokens). Cheapest capable model — Veda's default.
// Update these if the model changes. Cost is recorded per action for the console.
const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini':       { in: 0.15, out: 0.60 },
  'gpt-4o':            { in: 2.50, out: 10.0 },
  'gpt-4.1-mini':      { in: 0.40, out: 1.60 },
  'gpt-4.1':           { in: 2.00, out: 8.00 },
};

@Injectable()
export class OpenAiProvider {
  private readonly logger = new Logger(OpenAiProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('OPENAI_API_KEY');
  }

  get model(): string {
    return this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
  }

  /**
   * Single chat completion. Supports tool definitions for function-calling and
   * an optional JSON-object response format. Throws if not configured — callers
   * must check isConfigured() first and degrade gracefully.
   */
  async chat(opts: {
    messages: ChatMessage[];
    tools?: ToolDef[];
    jsonMode?: boolean;
    temperature?: number;
  }): Promise<ChatResult> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');

    const body: Record<string, unknown> = {
      model: this.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.4,
    };
    if (opts.tools?.length) body.tools = opts.tools;
    if (opts.jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`OpenAI ${res.status}: ${text.slice(0, 300)}`);
      throw new Error(`OpenAI request failed (${res.status}).`);
    }

    const data = (await res.json()) as {
      choices: { message: ChatMessage }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;
    const price = PRICING[this.model] ?? PRICING['gpt-4o-mini'];
    const costUsdMicro = Math.round(
      (promptTokens * price.in + completionTokens * price.out) / 1_000_000 * 1_000_000,
    );

    return {
      message: data.choices[0].message,
      costUsdMicro,
      promptTokens,
      completionTokens,
      raw: data,
    };
  }

  /** Embed text for retrieval (RAG). Uses text-embedding-3-small (1536 dims, cheap). */
  async embed(text: string): Promise<number[]> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured.');
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      this.logger.error(`OpenAI embeddings ${res.status}: ${t.slice(0, 200)}`);
      throw new Error(`Embedding failed (${res.status}).`);
    }
    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data[0].embedding;
  }

  /** Convenience: parse a JSON-mode response, returning {} on any parse failure. */
  parseJson<T = Record<string, unknown>>(content: string | null): T {
    if (!content) return {} as T;
    try {
      return JSON.parse(content) as T;
    } catch {
      // Strip code fences if the model wrapped output despite json mode.
      const cleaned = content.replace(/```json\s*|\s*```/g, '').trim();
      try {
        return JSON.parse(cleaned) as T;
      } catch {
        return {} as T;
      }
    }
  }
}
