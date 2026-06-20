import { Body, Controller, ForbiddenException, Logger, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Channel } from '@prisma/client';
import { Public } from '../../../common/auth/decorators';
import { LeadIntakeService, type NormalizedLead } from './lead-intake.service';

/**
 * Inbound lead webhooks for non-Meta ad sources.
 *   POST /webhooks/google-ads               — Google Lead Form (native format)
 *   POST /webhooks/linkedin?secret=...       — LinkedIn Lead Gen (via connector)
 *   POST /webhooks/lead?secret=...&source=.. — universal intake for any source
 *
 * Each becomes a tracked enquiry (first-touch attributed to the ad source) and
 * Veda picks it up. WhatsApp click-to-WhatsApp ads arrive via the WhatsApp flow.
 */
@ApiExcludeController()
@Controller('webhooks')
export class LeadIntakeController {
  private readonly logger = new Logger(LeadIntakeController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly intake: LeadIntakeService,
  ) {}

  // --- Google Ads Lead Form -------------------------------------------------
  @Public()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @Post('google-ads')
  async googleAds(@Body() body: Record<string, unknown>): Promise<{ received: true }> {
    const expected = this.config.get<string>('GOOGLE_ADS_KEY');
    if (expected && body['google_key'] !== expected) throw new ForbiddenException('Invalid Google Ads key.');
    if (body['is_test'] === true) { this.logger.log('Google Ads test lead received.'); }

    const cols = (body['user_column_data'] as Array<{ column_id?: string; string_value?: string }>) ?? [];
    const map: Record<string, string> = {};
    for (const c of cols) if (c.column_id) map[c.column_id] = c.string_value ?? '';

    const name = map['FULL_NAME'] || [map['FIRST_NAME'], map['LAST_NAME']].filter(Boolean).join(' ') || 'Google lead';
    const known = new Set(['FULL_NAME', 'FIRST_NAME', 'LAST_NAME', 'EMAIL', 'PHONE_NUMBER']);
    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(map)) if (!known.has(k) && v) extra[k] = v;

    await this.intake.ingestLead({
      source: Channel.GOOGLE_ADS,
      name,
      email: map['EMAIL'] || null,
      phone: map['PHONE_NUMBER'] || null,
      campaign: body['campaign_id'] ? `Campaign ${body['campaign_id']}` : 'Google Ads',
      externalId: body['lead_id'] ? String(body['lead_id']) : undefined,
      extra,
    });
    return { received: true };
  }

  // --- LinkedIn Lead Gen (via connector e.g. Zapier/Make) -------------------
  @Public()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @Post('linkedin')
  async linkedin(@Body() body: Record<string, unknown>, @Query('secret') secret?: string): Promise<{ received: true }> {
    this.assertSecret(secret);
    await this.intake.ingestLead(this.normalize(body, Channel.LINKEDIN, 'LinkedIn Ads'));
    return { received: true };
  }

  // --- Universal intake for any other source --------------------------------
  @Public()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @Post('lead')
  async generic(
    @Body() body: Record<string, unknown>,
    @Query('secret') secret?: string,
    @Query('source') source?: string,
  ): Promise<{ received: true }> {
    this.assertSecret(secret);
    const channel = SOURCE_MAP[(source ?? '').toLowerCase()] ?? Channel.REFERRAL;
    await this.intake.ingestLead(this.normalize(body, channel));
    return { received: true };
  }

  private assertSecret(secret?: string): void {
    const expected = this.config.get<string>('LEAD_WEBHOOK_SECRET');
    if (!expected) return; // not enforced until set
    if (secret !== expected) throw new ForbiddenException('Invalid lead webhook secret.');
  }

  /** Defensive field mapping that tolerates the many shapes connectors send. */
  private normalize(b: Record<string, unknown>, source: Channel, defaultCampaign?: string): NormalizedLead {
    const str = (...keys: string[]): string | undefined => {
      for (const k of keys) {
        const v = b[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      return undefined;
    };
    const name =
      (str('name', 'full_name', 'fullName', 'Name') ??
        [str('first_name', 'firstName', 'FirstName'), str('last_name', 'lastName', 'LastName')].filter(Boolean).join(' ')) ||
      'New lead';

    const handled = new Set([
      'name', 'full_name', 'fullName', 'Name', 'first_name', 'firstName', 'FirstName',
      'last_name', 'lastName', 'LastName', 'email', 'Email', 'emailAddress', 'phone',
      'Phone', 'phone_number', 'phoneNumber', 'campaign', 'campaignName', 'lead_id', 'leadId', 'id',
    ]);
    const extra: Record<string, string> = {};
    for (const [k, v] of Object.entries(b)) if (!handled.has(k) && typeof v === 'string' && v) extra[k] = v;

    return {
      source,
      name,
      email: str('email', 'Email', 'emailAddress') ?? null,
      phone: str('phone', 'Phone', 'phone_number', 'phoneNumber') ?? null,
      campaign: str('campaign', 'campaignName') ?? defaultCampaign ?? null,
      externalId: str('lead_id', 'leadId', 'id'),
      extra,
    };
  }
}

const SOURCE_MAP: Record<string, Channel> = {
  google: Channel.GOOGLE_ADS,
  google_ads: Channel.GOOGLE_ADS,
  linkedin: Channel.LINKEDIN,
  facebook: Channel.FACEBOOK,
  meta: Channel.FACEBOOK,
  instagram: Channel.INSTAGRAM,
  whatsapp: Channel.WHATSAPP,
  referral: Channel.REFERRAL,
};
