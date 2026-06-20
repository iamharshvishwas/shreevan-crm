import { Injectable, Logger } from '@nestjs/common';
import { OpenAiProvider } from './openai.provider';

const SYSTEM_PROMPT = `You are a privacy redactor for a wellness business CRM.

You will receive a call transcript. Return the SAME transcript but with every mention of medical or health details removed and replaced with "[health detail redacted]". This includes: medical conditions, diagnoses, symptoms, illnesses, injuries, mental-health conditions, medications, treatments, surgeries, allergies, pregnancy, disabilities, and any specific bodily/health complaints.

Keep everything else intact (names, scheduling, program interest, general conversation, logistics). Do not summarize or shorten. Do not add commentary.

Respond ONLY with JSON: { "redacted": "<the redacted transcript>" }.`;

// Lightweight fallback patterns if AI is unavailable. Intentionally broad —
// better to over-redact than store health detail.
const FALLBACK_TERMS = [
  'diabet', 'cancer', 'tumor', 'tumour', 'depress', 'anxiety', 'asthma', 'thyroid',
  'blood pressure', 'hypertension', 'arthritis', 'migraine', 'insomnia', 'pregnan',
  'surgery', 'medication', 'medicine', 'diagnos', 'disorder', 'disease', 'injury',
  'chronic', 'therapy', 'treatment', 'symptom', 'pain', 'allerg',
];

@Injectable()
export class RedactionService {
  private readonly logger = new Logger(RedactionService.name);

  constructor(private readonly ai: OpenAiProvider) {}

  /** Redact health/medical detail from free text before it is stored. */
  async redact(text: string): Promise<{ text: string; method: 'ai' | 'fallback' | 'empty' }> {
    if (!text?.trim()) return { text: '', method: 'empty' };

    if (this.ai.isConfigured()) {
      try {
        const result = await this.ai.chat({
          jsonMode: true,
          temperature: 0,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: text.slice(0, 12_000) },
          ],
        });
        const parsed = this.ai.parseJson<{ redacted: string }>(result.message.content);
        if (parsed.redacted) return { text: parsed.redacted, method: 'ai' };
      } catch (e) {
        this.logger.warn(`AI redaction failed, using fallback: ${(e as Error).message}`);
      }
    }
    return { text: this.fallbackRedact(text), method: 'fallback' };
  }

  /** Sentence-level scrub: drop any sentence containing a health term. */
  private fallbackRedact(text: string): string {
    return text
      .split(/(?<=[.!?\n])\s+/)
      .map((s) => (FALLBACK_TERMS.some((t) => s.toLowerCase().includes(t)) ? '[health detail redacted]' : s))
      .join(' ');
  }
}
