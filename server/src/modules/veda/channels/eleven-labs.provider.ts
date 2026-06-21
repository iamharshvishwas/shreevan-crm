import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * ElevenLabs text-to-speech. Returns MP3 audio for a piece of text so the
 * website chat widget can speak Veda's replies (Hindi + English).
 *
 * The API key stays server-side — the public widget never sees it.
 */
@Injectable()
export class ElevenLabsProvider {
  private readonly logger = new Logger(ElevenLabsProvider.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get<string>('ELEVENLABS_API_KEY');
  }

  /** Synthesize speech. Returns the MP3 buffer, or null if not configured / on error. */
  async speak(text: string): Promise<Buffer | null> {
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) return null;

    const voiceId = this.config.get<string>('ELEVENLABS_VOICE_ID')!;
    const model = this.config.get<string>('ELEVENLABS_MODEL')!;
    const clean = text.slice(0, 1200); // cap length to bound cost/latency

    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({
          text: clean,
          model_id: model,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        this.logger.error(`ElevenLabs ${res.status}: ${t.slice(0, 200)}`);
        return null;
      }
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      this.logger.error(`ElevenLabs request failed: ${(e as Error).message}`);
      return null;
    }
  }
}
