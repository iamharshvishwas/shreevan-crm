import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ImapFlow } from 'imapflow';
import { simpleParser, type ParsedMail } from 'mailparser';
import { VedaConfigService } from '../veda-config.service';
import { VedaLogService } from '../veda-log.service';
import { EmailInboundService } from './email-inbound.service';

const BATCH = 8;

/**
 * Polls a standard IMAP mailbox (e.g. a hosting-provider business inbox like
 * contact@shreevanwellness.com) for unread mail and runs each through the
 * shared inbound pipeline (→ EMAIL enquiry → Veda reply). Marks messages seen
 * so they aren't reprocessed. Opens a fresh connection per poll — simple and
 * robust for a 2-minute cadence; no persistent IDLE connection to babysit.
 *
 * Reuses SMTP_USER/SMTP_PASS as the IMAP credentials — same mailbox, just a
 * different protocol/port, which is how virtually every hosting provider
 * (Hostinger, GoDaddy, Zoho, etc.) sets up a business inbox.
 */
@Injectable()
export class ImapInboundService {
  private readonly logger = new Logger(ImapInboundService.name);

  constructor(
    private readonly env: ConfigService,
    private readonly config: VedaConfigService,
    private readonly logs: VedaLogService,
    private readonly inbound: EmailInboundService,
  ) {}

  private get isConfigured(): boolean {
    return !!(this.env.get<string>('IMAP_HOST') && this.env.get<string>('SMTP_USER') && this.env.get<string>('SMTP_PASS'));
  }

  @Cron('*/2 * * * *') // every 2 minutes
  async poll(): Promise<void> {
    if (!this.isConfigured) return;
    if (!(await this.config.isGloballyEnabled())) return;

    const client = new ImapFlow({
      host: this.env.get<string>('IMAP_HOST')!,
      port: this.env.get<number>('IMAP_PORT') ?? 993,
      secure: true,
      auth: { user: this.env.get<string>('SMTP_USER')!, pass: this.env.get<string>('SMTP_PASS')! },
      logger: false,
    });

    try {
      await client.connect();
    } catch (e) {
      this.logger.warn(`IMAP connect failed: ${describeImapError(e)}`);
      return;
    }

    let processed = 0;
    try {
      const lock = await client.getMailboxLock(this.env.get<string>('IMAP_MAILBOX') ?? 'INBOX');
      try {
        const uids = (await client.search({ seen: false }, { uid: true })) || [];
        for (const uid of uids.slice(0, BATCH)) {
          try {
            const msg = await client.fetchOne(uid, { source: true }, { uid: true });
            if (!msg || !msg.source) continue;
            const parsed = await simpleParser(msg.source);

            if (isAutomated(parsed)) continue;

            const from = parsed.from?.value?.[0];
            const email = from?.address?.toLowerCase();
            const name = from?.name?.trim() || undefined;
            const text = stripQuoted(plainText(parsed));

            if (email && text) {
              await this.inbound.handle({ fromEmail: email, fromName: name, subject: parsed.subject, text, messageId: parsed.messageId });
              processed++;
            }
          } catch (e) {
            this.logger.error(`IMAP inbound message uid=${uid} failed: ${describeImapError(e)}`);
          } finally {
            await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true }).catch(() => undefined);
          }
        }
      } finally {
        lock.release();
      }
    } catch (e) {
      this.logger.error(`IMAP inbound poll failed: ${describeImapError(e)}`);
    } finally {
      await client.logout().catch(() => undefined);
    }

    if (processed) await this.logs.write({ type: 'EMAIL_INBOUND', status: 'COMPLETED', output: { processed } as object, completedAt: new Date() });
  }
}

/** imapflow's errors for a server-rejected command (bad login, missing mailbox,
 *  etc.) all say just "Command failed" — the actually useful detail (what the
 *  server said, which command) is on extra properties, not the message. */
function describeImapError(e: unknown): string {
  const err = e as Error & { responseText?: string; executedCommand?: string; responseStatus?: string };
  if (err?.responseText) {
    const cmd = err.executedCommand?.split(' ')[1]; // "<tag> LOGIN ..." → "LOGIN"
    return `${err.responseStatus ?? 'server rejected'}${cmd ? ` ${cmd}` : ''} — ${err.responseText}`;
  }
  return err?.message ?? String(e);
}

/** Skip bulk/automated mail (newsletters, notifications, no-reply, auto-responders). */
function isAutomated(mail: ParsedMail): boolean {
  const from = (mail.from?.value?.[0]?.address ?? '').toLowerCase();
  if (/no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster/.test(from)) return true;
  // mailparser groups every List-* header (Unsubscribe, Id, ...) under one 'list' key
  // as a structured object — it does NOT expose 'list-unsubscribe'/'list-id' keys.
  if (mail.headers.get('list')) return true;
  const prec = String(mail.headers.get('precedence') ?? '').toLowerCase();
  if (prec === 'bulk' || prec === 'list' || prec === 'junk') return true;
  const auto = String(mail.headers.get('auto-submitted') ?? '').toLowerCase();
  if (auto && auto !== 'no') return true;
  return false;
}

/** Prefer the real plain-text part; fall back to a stripped version of the HTML body
 *  (plenty of real customer replies — Outlook/webmail — are HTML-only). */
function plainText(mail: ParsedMail): string {
  if (mail.text?.trim()) return mail.text;
  if (typeof mail.html === 'string') return stripHtml(mail.html);
  return '';
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Drop quoted reply history so Veda reasons over just the new message. */
function stripQuoted(body: string): string {
  const lines = body.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*On .+wrote:\s*$/.test(line)) break;       // "On <date> <name> wrote:"
    if (/^\s*-{2,}\s*Original Message\s*-{2,}/i.test(line)) break;
    if (/^\s*>/.test(line)) continue;                   // quoted lines
    out.push(line);
  }
  return out.join('\n').trim().slice(0, 4000);
}
