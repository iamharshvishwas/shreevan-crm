import { Body, Controller, ForbiddenException, Get, Logger, Post, Query, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { Public } from '../../../common/auth/decorators';
import { WhatsAppService } from './whatsapp.service';

/**
 * Single Meta callback URL for both WhatsApp Cloud API and Lead Ads (leadgen).
 * Configure this URL + verify token in the Meta app; dispatch is by `object`.
 *   GET  /api/v1/webhooks/meta  → subscription verification (hub.challenge)
 *   POST /api/v1/webhooks/meta  → signed event delivery
 */
@ApiExcludeController()
@Controller('webhooks/meta')
export class MetaWebhookController {
  private readonly logger = new Logger(MetaWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  @Public()
  @Get()
  verify(@Query() query: Record<string, string>): string {
    const expected = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];
    if (mode === 'subscribe' && expected && token === expected) {
      return challenge ?? '';
    }
    throw new ForbiddenException('Verification failed.');
  }

  @Public()
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Post()
  async receive(@Body() body: Record<string, unknown>, @Req() req: Request): Promise<{ received: true }> {
    this.assertSignature(req);

    const object = body.object as string | undefined;
    // WhatsApp messages and Lead Ads can arrive on the same URL. Swallow
    // processing errors and always 200 — Meta retries on non-200, and our
    // ingestion is idempotent, so we log and move on.
    try {
      if (object === 'whatsapp_business_account') {
        await this.whatsapp.processWhatsApp(body);
      } else if (object === 'page') {
        await this.whatsapp.processLeadgen(body);
      } else {
        this.logger.debug(`Ignoring Meta webhook object="${object}"`);
      }
    } catch (e) {
      this.logger.error(`Meta webhook processing failed: ${(e as Error).message}`);
    }
    return { received: true };
  }

  /** Verify X-Hub-Signature-256 against the raw request body using the app secret. */
  private assertSignature(req: Request): void {
    const secret = this.config.get<string>('META_APP_SECRET');
    if (!secret) {
      // No secret configured (e.g. early dev) — allow but warn.
      this.logger.warn('META_APP_SECRET not set — skipping webhook signature check.');
      return;
    }
    const header = req.headers['x-hub-signature-256'];
    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    if (typeof header !== 'string' || !raw) throw new ForbiddenException('Missing signature.');

    const expected = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Invalid signature.');
    }
  }
}
