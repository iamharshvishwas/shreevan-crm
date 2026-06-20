import { Body, Controller, ForbiddenException, Logger, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../../common/auth/decorators';
import { EmailInboundService, type InboundEmail } from './email-inbound.service';

/**
 * Inbound-email webhook. Point your inbound provider here:
 *   POST {PUBLIC_API_URL}/api/v1/webhooks/email?secret=EMAIL_WEBHOOK_SECRET
 *
 * Provider-agnostic JSON parsing — works with Postmark, Mailgun, SendGrid
 * (JSON mode), Resend, or a custom forwarder. Each inbound email becomes a
 * tracked EMAIL enquiry and Veda replies.
 */
@ApiExcludeController()
@Controller('webhooks/email')
export class EmailInboundController {
  private readonly logger = new Logger(EmailInboundController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly inbound: EmailInboundService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post()
  async receive(@Body() body: Record<string, unknown>, @Query('secret') secret?: string): Promise<{ received: true }> {
    this.assertSecret(secret);
    const mail = this.parse(body);
    if (mail) {
      try {
        await this.inbound.handle(mail);
      } catch (e) {
        this.logger.error(`Inbound email processing failed: ${(e as Error).message}`);
      }
    }
    return { received: true };
  }

  private assertSecret(secret?: string): void {
    const expected = this.config.get<string>('EMAIL_WEBHOOK_SECRET');
    if (!expected) return; // not enforced until set
    if (secret !== expected) throw new ForbiddenException('Invalid email webhook secret.');
  }

  /** Map the common provider payload shapes to our normalized InboundEmail. */
  private parse(b: Record<string, unknown>): InboundEmail | null {
    const str = (...keys: string[]): string | undefined => {
      for (const k of keys) {
        const v = b[k];
        if (typeof v === 'string' && v.trim()) return v;
      }
      return undefined;
    };

    const rawFrom = str('from', 'From', 'sender', 'fromFull', 'FromFull') ?? '';
    const fromNameField = str('fromName', 'FromName', 'from_name');
    const { email: fromEmail, name } = parseAddress(rawFrom);

    const text =
      str('text', 'TextBody', 'body-plain', 'stripped-text', 'plain', 'StrippedTextBody') ?? '';

    if (!fromEmail || !text) return null;

    return {
      fromEmail,
      fromName: fromNameField || name,
      subject: str('subject', 'Subject'),
      text,
      messageId: str('messageId', 'MessageID', 'Message-Id', 'message-id'),
    };
  }
}

/** Parse "Name <email@x.com>" or a bare address. */
function parseAddress(raw: string): { email: string; name?: string } {
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || undefined, email: m[2].trim().toLowerCase() };
  const at = raw.match(/[^\s<>]+@[^\s<>]+/);
  return { email: (at ? at[0] : raw).trim().toLowerCase() };
}
