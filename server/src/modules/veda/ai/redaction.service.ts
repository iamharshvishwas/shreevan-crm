import { Injectable, Logger } from '@nestjs/common';
import { OpenAiProvider } from './openai.provider';

const SYSTEM_PROMPT = `You are a privacy redactor for a wellness business CRM.

You will receive a call transcript. Return the SAME transcript but with every mention of medical or health details removed and replaced with "[health detail redacted]". This includes: medical conditions, diagnoses, symptoms, illnesses, injuries, mental-health conditions, medications, treatments, surgeries, allergies, pregnancy, disabilities, and any specific bodily/health complaints.

Keep everything else intact (names, scheduling, program interest, general conversation, logistics). Do not summarize or shorten. Do not add commentary.

Respond ONLY with JSON: { "redacted": "<the redacted transcript>" }.`;

// Fail-closed placeholder. A keyword scrub can never be trusted to catch every
// health detail (e.g. "trouble sleeping", "on beta blockers", "PTSD"), so when
// AI redaction is unavailable we withhold the text entirely rather than risk
// persisting medical information. The audio recording is still kept if needed.
const WITHHELD = '[withheld — automatic health-safe redaction was unavailable]';

@Injectable()
export class RedactionService {
  private readonly logger = new Logger(RedactionService.name);

  constructor(private readonly ai: OpenAiProvider) {}

  /**
   * Redact health/medical detail before storage. Fail-closed: if the AI
   * redactor is not configured or errors, the text is withheld (never stored
   * raw / under-redacted).
   */
  async redact(text: string): Promise<{ text: string; method: 'ai' | 'withheld' | 'empty' }> {
    if (!text?.trim()) return { text: '', method: 'empty' };

    if (!this.ai.isConfigured()) {
      this.logger.warn('Redaction withheld: AI not configured (fail-closed).');
      return { text: WITHHELD, method: 'withheld' };
    }

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
      this.logger.warn('Redaction withheld: AI returned no redacted text (fail-closed).');
    } catch (e) {
      this.logger.warn(`Redaction withheld: AI redaction failed (fail-closed): ${(e as Error).message}`);
    }
    return { text: WITHHELD, method: 'withheld' };
  }
}
