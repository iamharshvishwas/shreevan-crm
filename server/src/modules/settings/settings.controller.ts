import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/auth/decorators';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Admin-only: wipe demo/test CRM data before launch. Body: { confirm: "RESET" }. */
  @Post('reset-demo-data')
  @Roles('ADMIN')
  resetDemoData(@Body() body: { confirm?: string }) {
    return this.settings.resetTransactionalData(body?.confirm);
  }

  @Get('channels')
  channels() {
    return this.settings.channels();
  }

  @Get('sla-policies')
  slaPolicies() {
    return this.settings.slaPolicies();
  }

  @Get('routing-rules')
  routingRules() {
    return this.settings.routingRules();
  }
}
