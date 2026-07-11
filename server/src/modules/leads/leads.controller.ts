import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequireScreens } from '../../common/auth/decorators';
import { CurrentUser } from '../../common/auth/decorators';
import { AuthUser } from '../../common/auth/auth.types';
import { LeadsService } from './leads.service';
import {
  CloseLostDto, ConfirmBookingDto, ListLeadsDto, MoveStageDto, NextActionDto,
} from './dto/leads.dto';

// Access is fully screen-based: anyone with the 'leads' screen (or an admin)
// can view and act on leads. The mutations previously carried an extra
// @Roles('RELATIONSHIP') — removed, since non-admin roles no longer gate
// anything (all access is per-user allowedScreens now).
@ApiTags('leads')
@ApiBearerAuth()
@Controller('leads')
@RequireScreens('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list(@Query() dto: ListLeadsDto) {
    return this.leads.list(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.leads.get(id);
  }

  @Post(':id/move-stage')
  moveStage(@Param('id') id: string, @Body() dto: MoveStageDto, @CurrentUser() user: AuthUser) {
    return this.leads.moveStage(id, dto, user.id);
  }

  @Post(':id/next-action')
  nextAction(@Param('id') id: string, @Body() dto: NextActionDto, @CurrentUser() user: AuthUser) {
    return this.leads.setNextAction(id, dto, user.id);
  }

  @Post(':id/confirm-booking')
  confirm(@Param('id') id: string, @Body() dto: ConfirmBookingDto, @CurrentUser() user: AuthUser) {
    return this.leads.confirmBooking(id, dto, user.id);
  }

  @Post(':id/close-lost')
  closeLost(@Param('id') id: string, @Body() dto: CloseLostDto, @CurrentUser() user: AuthUser) {
    return this.leads.closeLost(id, dto, user.id);
  }
}
