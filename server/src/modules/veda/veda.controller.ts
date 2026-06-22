import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Roles, CurrentUser } from '../../common/auth/decorators';
import type { AuthUser } from '../../common/auth/auth.types';
import { VedaConfigService } from './veda-config.service';
import { VedaApprovalService } from './veda-approval.service';
import { VedaLogService } from './veda-log.service';
import { CommandService } from './agents/command.service';
import { EmailProvider } from './ai/email.provider';
import { VoiceProvider } from './channels/voice.provider';
import { PrismaService } from '../../database/prisma.service';
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
    private readonly email: EmailProvider,
    private readonly voice: VoiceProvider,
    private readonly prisma: PrismaService,
  ) {}

  // Place a test voice call to verify the Vapi voice pipeline. ADMIN only.
  @Post('test-call')
  @Roles('ADMIN')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async testCall(@Body() body: { to?: string }) {
    const to = body.to?.trim();
    if (!to) return { ok: false, error: 'Phone number required (E.164, e.g. +9198…).' };
    // A throwaway DiscoveryCall so the end-of-call webhook can attach the transcript.
    const call = await this.prisma.discoveryCall.create({
      data: { scheduledAt: new Date(), timezone: 'Asia/Kolkata', status: 'SCHEDULED', prepNotes: 'Veda test call' },
    });
    const result = await this.voice.placeCall({ to, leadName: 'Veda Test', discoveryCallId: call.id });
    return { to, callId: call.id, ...result };
  }

  // Send a test email to verify the outbound email config (SMTP/Resend). ADMIN only.
  @Post('test-email')
  @Roles('ADMIN')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async testEmail(@Body() body: { to?: string }, @CurrentUser() user: AuthUser) {
    const to = body.to?.trim() || user.email;
    const result = await this.email.send({
      to,
      subject: 'Veda test email — Shreevan Wellness',
      body: 'Namaste 🌿\n\nThis is a test email from Veda to confirm email sending is working.\nIf you received this, your email setup is live.\n\n— Veda · Shreevan Wellness',
    });
    return { to, ...result };
  }

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
