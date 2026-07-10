import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequireScreens } from '../../common/auth/decorators';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';
import { CallsService } from './calls.service';

class CompleteCallDto { @IsOptional() @IsString() outcome?: string; }
class RescheduleCallDto { @IsISO8601() scheduledAt!: string; }

@ApiTags('discovery-calls')
@ApiBearerAuth()
@Controller('discovery-calls')
@RequireScreens('calls')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Get()
  list() {
    return this.calls.list();
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @Body() dto: CompleteCallDto) {
    return this.calls.complete(id, dto.outcome);
  }

  @Post(':id/reschedule')
  reschedule(@Param('id') id: string, @Body() dto: RescheduleCallDto) {
    return this.calls.reschedule(id, dto.scheduledAt);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.calls.cancel(id);
  }
}
