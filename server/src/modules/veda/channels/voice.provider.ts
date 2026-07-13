import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KnowledgeService } from '../knowledge/knowledge.service';
import { VEDA_CONVERSATION_CRAFT, VEDA_OPERATING_RULES } from '../veda-operating-rules';

export interface PlaceCallInput {
  to: string;            // E.164 number
  leadName: string;
  programInterest?: string | null;
  language?: string | null;
  discoveryCallId: string;
}

export interface PlaceCallResult {
  placed: boolean;
  simulated: boolean;
  externalCallId?: string;
  detail: string;
}

/**
 * AI voice calls via Vapi. Live when VAPI_API_KEY + VAPI_PHONE_NUMBER_ID are set;
 * otherwise simulated (same pattern as the other providers). Builds Veda's
 * assistant inline unless VAPI_ASSISTANT_ID is provided.
 *
 * The call opens with a recording-consent line and the assistant is instructed
 * to NEVER ask about or note medical/health details (domain rule).
 */
@Injectable()
export class VoiceProvider {
  private readonly logger = new Logger(VoiceProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly knowledge: KnowledgeService,
  ) {}

  isLive(): boolean {
    return !!(this.config.get<string>('VAPI_API_KEY') && this.config.get<string>('VAPI_PHONE_NUMBER_ID'));
  }

  async placeCall(input: PlaceCallInput): Promise<PlaceCallResult> {
    const apiKey = this.config.get<string>('VAPI_API_KEY');
    const phoneNumberId = this.config.get<string>('VAPI_PHONE_NUMBER_ID');

    if (!this.isLive()) {
      this.logger.log(`[simulated voice call] to=${input.to} for ${input.leadName}`);
      return { placed: false, simulated: true, detail: 'Recorded locally — set VAPI_API_KEY + VAPI_PHONE_NUMBER_ID to call for real.' };
    }

    const body: Record<string, unknown> = {
      phoneNumberId,
      customer: { number: input.to, name: input.leadName },
      metadata: { discoveryCallId: input.discoveryCallId },
    };

    const assistantId = this.config.get<string>('VAPI_ASSISTANT_ID');
    if (assistantId) {
      body.assistantId = assistantId;
      body.assistantOverrides = {
        variableValues: { name: input.leadName, program: input.programInterest ?? 'our wellness programs' },
        ...this.serverConfig(),
      };
    } else {
      const kb = await this.knowledge.fullContext().catch(() => '');
      body.assistant = this.buildAssistant(input, kb);
    }

    const res = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Vapi ${res.status}: ${text.slice(0, 300)}`);
      throw new Error(`Voice call failed (${res.status}).`);
    }
    const data = (await res.json()) as { id?: string };
    return { placed: true, simulated: false, externalCallId: data.id, detail: 'Call placed via Vapi.' };
  }

  private serverConfig(): Record<string, unknown> {
    const base = this.config.get<string>('PUBLIC_API_URL');
    const secret = this.config.get<string>('VAPI_WEBHOOK_SECRET');
    return { server: { url: `${base}/api/v1/webhooks/vapi`, ...(secret ? { secret } : {}) } };
  }

  private buildAssistant(input: PlaceCallInput, knowledge = ''): Record<string, unknown> {
    const firstName = input.leadName.split(' ')[0];
    const program = input.programInterest ?? 'our wellness programs';

    const systemPrompt = `${VEDA_PERSONA}

You are on a short OUTBOUND discovery call with ${input.leadName}, who showed interest in ${program}.

GOALS:
- Warmly understand what they are hoping to get from a retreat and their preferred timing.
- Answer their questions about the programs at a high level.
- Confirm interest and agree on a clear next step (e.g. our team will share details / a proposal).
- If it is a bad time, offer to reconnect later and end politely.${kbSection(knowledge)}`;

    return this.baseAssistant(
      systemPrompt,
      `Namaste ${firstName}! This is Veda calling from Shreevan Wellness. Just so you know, this call may be recorded for quality. Is now a good time to talk for a few minutes?`,
    );
  }

  /** Assistant for INBOUND calls (someone rings the business number). */
  async buildInboundAssistant(): Promise<Record<string, unknown>> {
    const knowledge = await this.knowledge.fullContext().catch(() => '');
    const systemPrompt = `${VEDA_PERSONA}

You are answering an INBOUND call — someone has called Shreevan Wellness.

GOALS:
- Warmly greet them and understand why they're calling and what they're looking for.
- Answer questions about our retreats at a high level.
- Capture their name and either offer to book a discovery call or note that our team will follow up.${kbSection(knowledge)}`;

    return this.baseAssistant(
      systemPrompt,
      'Namaste! Thank you for calling Shreevan Wellness. This is Veda — just so you know, this call may be recorded for quality. How can I help you today?',
    );
  }

  private baseAssistant(systemPrompt: string, firstMessage: string): Record<string, unknown> {
    const vocab = this.vocabBoostList();
    // Inject pronunciation guidance for brand/program words so the LLM speaks
    // "Shreevan" correctly instead of mishearing/misspelling it.
    const finalPrompt = vocab.length
      ? `${systemPrompt}\n\nPRONUNCIATION:\n${vocab.map((w) => `- "${w}": pronounce clearly as a proper noun; never substitute or abbreviate.`).join('\n')}`
      : systemPrompt;

    // nova-3 supports BOTH multilingual ('multi') AND keyterm boosting; nova-2
    // would reject the keyterm field with a 400. Keep this on nova-3 (or flux).
    const transcriber: Record<string, unknown> = {
      provider: 'deepgram',
      model: 'nova-3',
      language: 'multi',
    };
    // Deepgram keyterm boosting helps the STT transcribe brand words right
    // ("Shreevan" → "Shreevan", not "Shriwan").
    if (vocab.length) transcriber.keyterm = vocab;

    return {
      firstMessage,
      model: {
        provider: 'openai',
        model: this.config.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini',
        messages: [{ role: 'system', content: finalPrompt }],
      },
      voice: { provider: 'vapi', voiceId: this.config.get<string>('VAPI_VOICE_ID') ?? 'elliot' },
      transcriber,
      recordingEnabled: true,
      endCallFunctionEnabled: true,
      ...this.serverConfig(),
    };
  }

  /** Brand/program words to favour in STT + TTS. Configurable via VOICE_VOCAB_BOOST. */
  private vocabBoostList(): string[] {
    const raw = this.config.get<string>('VOICE_VOCAB_BOOST') ?? '';
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
}

function kbSection(knowledge: string): string {
  return knowledge ? `\n\nKNOWLEDGE BASE (use to answer accurately; if not covered, say the team will confirm):\n${knowledge}` : '';
}

const VEDA_PERSONA = `You are Veda, the AI relationship guide for Shreevan Wellness, a premium Indian wellness-retreat business serving Indian and international guests.

STYLE:
- Speak in the caller's language — Hindi, English, or Hinglish — matching how they speak.
- Calm, warm, premium, unhurried. Never pushy or salesy. Keep turns short and conversational.

${VEDA_CONVERSATION_CRAFT}

${VEDA_OPERATING_RULES}`;
