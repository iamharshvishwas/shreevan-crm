import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles, CurrentUser } from '../../common/auth/decorators';
import type { AuthUser } from '../../common/auth/auth.types';
import { VedaConfigService } from './veda-config.service';
import { VedaApprovalService } from './veda-approval.service';
import { VedaLogService } from './veda-log.service';
import { CommandService } from './agents/command.service';
import {
  UpdateVedaConfigDto,
  ReviewApprovalDto,
  ApprovalListQueryDto,
  LogListQueryDto,
  CommandDto,
} from './dto/veda.dto';

@ApiBearerAuth()
@ApiTags('veda')
@Controller('veda')
export class VedaController {
  constructor(
    private readonly config: VedaConfigService,
    private readonly approvals: VedaApprovalService,
    private readonly logs: VedaLogService,
    private readonly command: CommandService,
  ) {}

  // Voice/text command — any authenticated team member.
  @Post('command')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  runCommand(@Body() dto: CommandDto, @CurrentUser() user: AuthUser) {
    return this.command.run(dto.transcript, user.id);
  }

  // Config — ADMIN only
  @Get('config')
  @Roles('ADMIN')
  getConfig() {
    return this.config.get();
  }

  @Patch('config')
  @Roles('ADMIN')
  updateConfig(@Body() dto: UpdateVedaConfigDto) {
    return this.config.update(dto);
  }

  // Approvals — all authenticated users can see, any can review
  @Get('approvals')
  listApprovals(@Query() query: ApprovalListQueryDto) {
    return this.approvals.list({
      status: query.status,
      limit:  query.limit  ? +query.limit  : 20,
      offset: query.offset ? +query.offset : 0,
    });
  }

  @Patch('approvals/:id/approve')
  approveAction(
    @Param('id') id: string,
    @Body() dto: ReviewApprovalDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.approvals.approve(id, user.id, dto.note);
  }

  @Patch('approvals/:id/reject')
  rejectAction(
    @Param('id') id: string,
    @Body() dto: ReviewApprovalDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.approvals.reject(id, user.id, dto.note);
  }

  // Logs
  @Get('logs')
  getLogs(@Query() query: LogListQueryDto) {
    return this.logs.list({
      entityType: query.entityType,
      entityId:   query.entityId,
      limit:      query.limit  ? +query.limit  : 30,
      offset:     query.offset ? +query.offset : 0,
    });
  }

  @Get('summary')
  getSummary() {
    return this.logs.summary();
  }

  @Get('analytics')
  getAnalytics() {
    return this.logs.analytics();
  }

  @Get('pending-count')
  pendingCount() {
    return this.approvals.pendingCount().then((count) => ({ count }));
  }
}
