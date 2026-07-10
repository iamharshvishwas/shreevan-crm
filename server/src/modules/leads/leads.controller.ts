import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, RequireScreens } from '../../common/auth/decorators';
import { CurrentUser } from '../../common/auth/decorators';
import { AuthUser } from '../../common/auth/auth.types';
import { LeadsService } from './leads.service';
import {
  CloseLostDto, ConfirmBookingDto, ListLeadsDto, MoveStageDto, NextActionDto,
} from './dto/leads.dto';

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
  @Roles('RELATIONSHIP')
  moveStage(@Param('id') id: string, @Body() dto: MoveStageDto, @CurrentUser() user: AuthUser) {
    return this.leads.moveStage(id, dto, user.id);
  }

  @Post(':id/next-action')
  @Roles('RELATIONSHIP')
  nextAction(@Param('id') id: string, @Body() dto: NextActionDto, @CurrentUser() user: AuthUser) {
    return this.leads.setNextAction(id, dto, user.id);
  }

  @Post(':id/confirm-booking')
  @Roles('RELATIONSHIP')
  confirm(@Param('id') id: string, @Body() dto: ConfirmBookingDto, @CurrentUser() user: AuthUser) {
    return this.leads.confirmBooking(id, dto, user.id);
  }

  @Post(':id/close-lost')
  @Roles('RELATIONSHIP')
  closeLost(@Param('id') id: string, @Body() dto: CloseLostDto, @CurrentUser() user: AuthUser) {
    return this.leads.closeLost(id, dto, user.id);
  }
}
