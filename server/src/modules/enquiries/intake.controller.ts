import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { EnquiriesService } from './enquiries.service';
import { IngestionService } from './ingestion.service';
import { ManualEnquiryDto, WebsiteEnquiryDto } from './dto/enquiries.dto';
import { NormalizedInboundEvent } from './dto/inbound-event.dto';
import { Public } from '../../common/auth/decorators';
import { ForbiddenError } from '../../common/errors/domain.errors';

/** Public intake + provider webhooks. Authenticated agents use EnquiriesController. */
@ApiTags('intake')
@Controller()
export class IntakeController {
  constructor(
    private readonly enquiries: EnquiriesService,
    private readonly ingestion: IngestionService,
    private readonly config: ConfigService,
  ) {}

  // --- Public website form (fixed schema) ---
  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('intake/website')
  website(@Body() dto: WebsiteEnquiryDto) {
    return this.enquiries.createWebsite(dto);
  }

  // --- Public flexible form intake (any form, any fields) ---
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('intake/form')
  form(@Body() body: Record<string, unknown>) {
    return this.enquiries.createFormSubmission(body);
  }

  // --- Authenticated manual phone/walk-in entry ---
  @Post('enquiries/manual')
  manual(@Body() dto: ManualEnquiryDto) {
    return this.enquiries.createManual(dto);
  }

  // Live provider webhooks are handled by MetaWebhookController (/webhooks/meta)
  // in the Veda module, which owns signature verification + parsing.

  // --- Development-only inbound simulation (blocked in production) ---
  @Post('enquiries/simulate')
  simulate(@Body() ev: NormalizedInboundEvent) {
    if (!this.config.get<boolean>('ENABLE_SIMULATION')) {
      throw new ForbiddenError('Inbound simulation is disabled.');
    }
    return this.ingestion.ingest(ev, { simulated: true });
  }
}
