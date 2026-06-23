import { Body, Controller, ForbiddenException, Logger, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Public } from '../../../common/auth/decorators';
import { VoiceService } from './voice.service';
import { VoiceProvider } from './voice.provider';
import { VedaLogService } from '../veda-log.service';

/**
 * Vapi voice-call webhook. Configure this URL (PUBLIC_API_URL + /api/v1/webhooks/vapi)
 * and the shared secret in the Vapi assistant's server settings; we set both
 * automatically when placing inline-assistant calls.
 */
@ApiExcludeController()
@Controller('webhooks/vapi')
export class VapiWebhookController {
  private readonly logger = new Logger(VapiWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly voice: VoiceService,
    private readonly voiceProvider: VoiceProvider,
    private readonly logs: VedaLogService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  @Post()
  async receive(@Body() body: Record<string, unknown>, @Req() req: Request): Promise<unknown> {
    this.assertSecret(req);
    const message = body.message as Record<string, unknown> | undefined;
    const type = message?.type as string | undefined;

    // Inbound call: Vapi asks which assistant to run — return Veda's inbound assistant.
    if (type === 'assistant-request') {
      const caller = ((message?.call as Record<string, unknown>)?.customer as Record<string, unknown>)?.number;
      await this.logs.write({
        type: 'VOICE_INBOUND', status: 'RUNNING', entityType: 'Call',
        input: { from: caller ?? 'unknown' } as object,
      }).catch(() => undefined);
      return { assistant: await this.voiceProvider.buildInboundAssistant() };
    }

    if (message) {
      try {
        await this.voice.handleMessage(message as never);
      } catch (e) {
        this.logger.error(`Vapi webhook processing failed: ${(e as Error).message}`);
      }
    }
    return { received: true };
  }

  /** Vapi sends the configured server secret as the X-Vapi-Secret header. */
  private assertSecret(req: Request): void {
    const secret = this.config.get<string>('VAPI_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('VAPI_WEBHOOK_SECRET not set — skipping Vapi webhook auth.');
      return;
    }
    const header = req.headers['x-vapi-secret'];
    if (header !== secret) throw new ForbiddenException('Invalid Vapi secret.');
  }
}
