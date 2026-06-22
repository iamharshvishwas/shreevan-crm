import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { VedaConfigService } from '../veda-config.service';
import { VedaLogService } from '../veda-log.service';
import { EmailInboundService } from './email-inbound.service';
import { GmailClient, gmailHeader, extractPlainText, type GmailMessage } from './gmail.client';

const BATCH = 8;

/**
 * Polls the Gmail inbox for unread mail and runs each through the shared inbound
 * pipeline (→ EMAIL enquiry → Veda reply). Marks messages read so they aren't
 * processed twice. Needs a refresh token with the gmail.modify scope.
 */
@Injectable()
export class GmailInboundService {
  private readonly logger = new Logger(GmailInboundService.name);

  constructor(
    private readonly env: ConfigService,
    private readonly config: VedaConfigService,
    private readonly logs: VedaLogService,
    private readonly gmail: GmailClient,
    private readonly inbound: EmailInboundService,
  ) {}

  @Cron('*/2 * * * *') // every 2 minutes
  async poll(): Promise<void> {
    if (!this.gmail.isConfigured()) return;
    if (!(await this.config.isGloballyEnabled())) return;

    // Safety: inbound is OFF unless a label is set. Veda only reads mail under
    // that label — never a whole personal inbox. (Use 'INBOX' for a dedicated mailbox.)
    const label = this.env.get<string>('GMAIL_INBOUND_LABEL');
    if (!label) return;
    const query = `label:"${label}" is:unread -in:chats -from:me`;

    let token: string;
    try {
      token = await this.gmail.accessToken();
    } catch (e) {
      this.logger.warn(`Gmail inbound auth failed: ${(e as Error).message}`);
      return;
    }

    let ids: string[];
    try {
      ids = await this.gmail.listIds(token, query, BATCH);
    } catch (e) {
      // 403 here usually means the refresh token lacks the gmail.modify scope.
      this.logger.warn(`Gmail inbound list failed (scope?): ${(e as Error).message}`);
      return;
    }
    if (!ids.length) return;

    let processed = 0;
    for (const id of ids) {
      try {
        const msg = await this.gmail.getMessage(token, id);

        // Never reply to newsletters, no-reply senders, mailing lists or auto-responders.
        if (isAutomated(msg)) {
          await this.gmail.markRead(token, id);
          continue;
        }

        const from = gmailHeader(msg, 'From') ?? '';
        const subject = gmailHeader(msg, 'Subject') ?? '';
        const { email, name } = parseFrom(from);
        const text = stripQuoted(extractPlainText(msg.payload));

        if (email && text) {
          await this.inbound.handle({ fromEmail: email, fromName: name, subject, text, messageId: msg.id });
          processed++;
        }
        await this.gmail.markRead(token, id); // mark read so we don't loop
      } catch (e) {
        this.logger.error(`Gmail inbound message ${id} failed: ${(e as Error).message}`);
        await this.gmail.markRead(token, id).catch(() => undefined);
      }
    }
    if (processed) await this.logs.write({ type: 'EMAIL_INBOUND', status: 'COMPLETED', output: { processed } as object, completedAt: new Date() });
  }
}

/** Skip bulk/automated mail (newsletters, notifications, no-reply, auto-responders). */
function isAutomated(msg: GmailMessage): boolean {
  const from = (gmailHeader(msg, 'From') ?? '').toLowerCase();
  if (/no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster/.test(from)) return true;
  if (gmailHeader(msg, 'List-Unsubscribe') || gmailHeader(msg, 'List-Id')) return true; // mailing list / marketing
  const prec = (gmailHeader(msg, 'Precedence') ?? '').toLowerCase();
  if (prec === 'bulk' || prec === 'list' || prec === 'junk') return true;
  const auto = (gmailHeader(msg, 'Auto-Submitted') ?? '').toLowerCase();
  if (auto && auto !== 'no') return true; // out-of-office / auto-replies
  return false;
}

/** Parse "Name <email>" or a bare address. */
function parseFrom(raw: string): { email: string; name?: string } {
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || undefined, email: m[2].trim().toLowerCase() };
  const at = raw.match(/[^\s<>]+@[^\s<>]+/);
  return { email: (at ? at[0] : raw).trim().toLowerCase() };
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
