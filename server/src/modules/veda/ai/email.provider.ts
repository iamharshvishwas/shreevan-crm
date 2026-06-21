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
 *  1. Gmail API (OAuth) — HTTPS, works on Railway where SMTP ports are blocked.
 *  2. SMTP (e.g. Gmail App Password) — only where SMTP egress is allowed.
 *  3. Resend API — needs a verified domain.
 *  4. Simulated — recorded locally so the draft→approve→send flow still works.
 */
@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  private get gmailApiReady(): boolean {
    return !!(
      this.config.get<string>('GMAIL_CLIENT_ID') &&
      this.config.get<string>('GMAIL_CLIENT_SECRET') &&
      this.config.get<string>('GMAIL_REFRESH_TOKEN')
    );
  }

  private get smtpReady(): boolean {
    return !!(this.config.get<string>('SMTP_HOST') && this.config.get<string>('SMTP_USER') && this.config.get<string>('SMTP_PASS'));
  }

  isLive(): boolean {
    return this.gmailApiReady || this.smtpReady || !!this.config.get<string>('RESEND_API_KEY');
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    if (this.gmailApiReady) return this.sendViaGmailApi(input);
    if (this.smtpReady) return this.sendViaSmtp(input);
    if (this.config.get<string>('RESEND_API_KEY')) return this.sendViaResend(input);

    this.logger.log(`[simulated email] to=${input.to} subject="${input.subject}"`);
    return { delivered: false, simulated: true, detail: 'Recorded locally — configure Gmail API / SMTP / Resend to send.' };
  }

  // --- Gmail API (OAuth, HTTPS) --------------------------------------------
  private async gmailAccessToken(): Promise<string> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.get<string>('GMAIL_CLIENT_ID')!,
        client_secret: this.config.get<string>('GMAIL_CLIENT_SECRET')!,
        refresh_token: this.config.get<string>('GMAIL_REFRESH_TOKEN')!,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      this.logger.error(`Gmail token ${res.status}: ${t.slice(0, 200)}`);
      throw new Error('Gmail OAuth token refresh failed — check GMAIL_* credentials.');
    }
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new Error('Gmail OAuth returned no access token.');
    return data.access_token;
  }

  private async sendViaGmailApi(input: SendEmailInput): Promise<SendEmailResult> {
    const token = await this.gmailAccessToken();
    const from = this.config.get<string>('VEDA_FROM_EMAIL')!;
    const raw = buildRawMessage(from, input.to, input.subject, input.body);

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      this.logger.error(`Gmail send ${res.status}: ${t.slice(0, 300)}`);
      throw new Error(`Gmail send failed (${res.status}).`);
    }
    const data = (await res.json()) as { id?: string };
    return { delivered: true, simulated: false, detail: 'Sent via Gmail API.', providerId: data.id };
  }

  // --- SMTP (Gmail App Password etc.) --------------------------------------
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

/** Build an RFC 822 message and base64url-encode it for the Gmail API `raw` field. */
function buildRawMessage(from: string, to: string, subject: string, body: string): string {
  const encodedSubject = '=?UTF-8?B?' + Buffer.from(subject, 'utf8').toString('base64') + '?=';
  const bodyB64 = Buffer.from(body, 'utf8').toString('base64');
  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    bodyB64,
  ].join('\r\n');
  return Buffer.from(mime, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
