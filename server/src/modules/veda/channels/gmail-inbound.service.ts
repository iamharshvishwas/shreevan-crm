import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VedaConfigService } from '../veda-config.service';
import { VedaLogService } from '../veda-log.service';
import { EmailInboundService } from './email-inbound.service';
import { GmailClient, gmailHeader, extractPlainText } from './gmail.client';

const QUERY = 'in:inbox is:unread -in:chats -from:me';
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
    private readonly config: VedaConfigService,
    private readonly logs: VedaLogService,
    private readonly gmail: GmailClient,
    private readonly inbound: EmailInboundService,
  ) {}

  @Cron('*/2 * * * *') // every 2 minutes
  async poll(): Promise<void> {
    if (!this.gmail.isConfigured()) return;
    if (!(await this.config.isGloballyEnabled())) return;

    let token: string;
    try {
      token = await this.gmail.accessToken();
    } catch (e) {
      this.logger.warn(`Gmail inbound auth failed: ${(e as Error).message}`);
      return;
    }

    let ids: string[];
    try {
      ids = await this.gmail.listIds(token, QUERY, BATCH);
    } catch (e) {
      // 403 here usually means the refresh token lacks the gmail.modify scope.
      this.logger.warn(`Gmail inbound list failed (scope?): ${(e as Error).message}`);
      return;
    }
    if (!ids.length) return;

    for (const id of ids) {
      try {
        const msg = await this.gmail.getMessage(token, id);
        const from = gmailHeader(msg, 'From') ?? '';
        const subject = gmailHeader(msg, 'Subject') ?? '';
        const { email, name } = parseFrom(from);
        const text = stripQuoted(extractPlainText(msg.payload));

        if (email && text) {
          await this.inbound.handle({ fromEmail: email, fromName: name, subject, text, messageId: msg.id });
        }
        await this.gmail.markRead(token, id); // always mark read so we don't loop
      } catch (e) {
        this.logger.error(`Gmail inbound message ${id} failed: ${(e as Error).message}`);
        await this.gmail.markRead(token, id).catch(() => undefined);
      }
    }
    await this.logs.write({ type: 'EMAIL_INBOUND', status: 'COMPLETED', output: { processed: ids.length } as object, completedAt: new Date() });
  }
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
