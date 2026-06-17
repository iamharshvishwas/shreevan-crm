import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

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
