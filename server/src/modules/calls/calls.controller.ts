import { Body, Controller, Get, Param, Post, Res, StreamableFile } from '@nestjs/common';
import { RequireScreens } from '../../common/auth/decorators';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';
import type { Response } from 'express';
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

  /** Proxies the recording from Vapi (which now requires an authenticated
   *  request) so the frontend can play/download it without exposing the Vapi
   *  API key to the browser. */
  @Get(':id/recording')
  async recording(@Param('id') id: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const { buffer, contentType } = await this.calls.getRecording(id);
    res.set({ 'Content-Type': contentType, 'Cache-Control': 'private, max-age=3600' });
    return new StreamableFile(buffer);
  }
}
