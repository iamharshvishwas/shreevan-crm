import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string; // plain text / lightweight HTML
}

export interface SendEmailResult {
  delivered: boolean;
  simulated: boolean;
  detail: string;
  providerId?: string;
}

/**
 * Sends Veda's emails via Resend when RESEND_API_KEY is set; otherwise records
 * the send as simulated (mirrors the SimulationAdapter pattern for channels).
 * This keeps the full draft → approve → send flow working before the email
 * provider is wired, and goes live the moment the key is added.
 */
@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);

  constructor(private readonly config: ConfigService) {}

  isLive(): boolean {
    return !!this.config.get<string>('RESEND_API_KEY');
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('VEDA_FROM_EMAIL')!;

    if (!apiKey) {
      this.logger.log(`[simulated email] to=${input.to} subject="${input.subject}"`);
      return { delivered: false, simulated: true, detail: 'Recorded locally — set RESEND_API_KEY to send for real.' };
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.body,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Resend ${res.status}: ${text.slice(0, 300)}`);
      throw new Error(`Email send failed (${res.status}).`);
    }

    const data = (await res.json()) as { id?: string };
    return { delivered: true, simulated: false, detail: 'Sent via Resend.', providerId: data.id };
  }
}
