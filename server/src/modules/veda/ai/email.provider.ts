import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

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
 * Sends Veda's emails. Priority:
 *  1. SMTP — the business mailbox (e.g. contact@shreevanwellness.com via your
 *     hosting provider). VEDA_FROM_EMAIL should match/alias SMTP_USER — most
 *     hosting SMTP servers reject or rewrite a From address that isn't the
 *     authenticated account.
 *  2. Resend API — needs a verified domain.
 *  3. Simulated — recorded locally so the draft→approve→send flow still works.
 */
@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  private get smtpReady(): boolean {
    return !!(this.config.get<string>('SMTP_HOST') && this.config.get<string>('SMTP_USER') && this.config.get<string>('SMTP_PASS'));
  }

  isLive(): boolean {
    return this.smtpReady || !!this.config.get<string>('RESEND_API_KEY');
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (this.smtpReady) return this.sendViaSmtp(input);
    if (this.config.get<string>('RESEND_API_KEY')) return this.sendViaResend(input);

    this.logger.log(`[simulated email] to=${input.to} subject="${input.subject}"`);
    return { delivered: false, simulated: true, detail: 'Recorded locally — configure SMTP / Resend to send.' };
  }

  // --- SMTP (business mailbox, e.g. contact@shreevanwellness.com) ----------
  private smtpTransport(): Transporter {
    if (!this.transporter) {
      const port = this.config.get<number>('SMTP_PORT') ?? 465;
      const opts = {
        host: this.config.get<string>('SMTP_HOST'),
        port,
        secure: port === 465,
        auth: { user: this.config.get<string>('SMTP_USER'), pass: this.config.get<string>('SMTP_PASS') },
        family: 4,                // force IPv4 (Railway IPv6 egress is unreliable)
        connectionTimeout: 15000, // fail fast instead of hanging ~120s
        greetingTimeout: 10000,
        socketTimeout: 20000,
      };
      // nodemailer's overloaded typings don't expose `family`; the option is valid at runtime.
      this.transporter = nodemailer.createTransport(opts as unknown as Parameters<typeof nodemailer.createTransport>[0]);
    }
    return this.transporter;
  }

  private async sendViaSmtp(input: SendEmailInput): Promise<SendEmailResult> {
    const from = this.config.get<string>('VEDA_FROM_EMAIL')!;
    const info = await this.smtpTransport().sendMail({ from, to: input.to, subject: input.subject, text: input.body });
    return { delivered: true, simulated: false, detail: 'Sent via SMTP.', providerId: info.messageId };
  }

  // --- Resend ---------------------------------------------------------------
  private async sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('VEDA_FROM_EMAIL')!;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, text: input.body }),
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
