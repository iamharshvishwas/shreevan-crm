import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { TwoFactorService } from './two-factor.service';
import {
  ChangePasswordDto,
  LoginDto,
  LoginResult,
  RefreshDto,
  TokensDto,
  TwoFactorCodeDto,
  TwoFactorVerifyDto,
} from './dto/auth.dto';
import { CurrentUser, Public } from '../../common/auth/decorators';
import { AuthUser } from '../../common/auth/auth.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  private meta(req: Request) {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResult> {
    return this.auth.login(dto.email, dto.password, this.meta(req));
  }

  /** Second step of a 2FA login — exchange the challenge token + code for tokens. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/verify')
  verify2fa(@Body() dto: TwoFactorVerifyDto, @Req() req: Request): Promise<TokensDto> {
    return this.auth.verify2fa(dto.challengeToken, dto.code, this.meta(req));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request): Promise<TokensDto> {
    return this.auth.refresh(dto.refreshToken, this.meta(req));
  }

  @Post('logout')
  async logout(@Body() dto: RefreshDto): Promise<{ success: true }> {
    await this.auth.logout(dto.refreshToken);
    return { success: true };
  }

  @Post('logout-all')
  async logoutAll(@CurrentUser() user: AuthUser): Promise<{ success: true }> {
    await this.auth.logoutAll(user.id);
    return { success: true };
  }

  /** Change the signed-in user's own password. Returns a fresh token pair. */
  @ApiBearerAuth()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Patch('password')
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthUser, @Req() req: Request): Promise<TokensDto> {
    return this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword, this.meta(req));
  }

  // ---- Two-factor authentication (TOTP) ----

  /** Current 2FA state for the signed-in user (+ whether admin setup is still required). */
  @ApiBearerAuth()
  @Get('2fa/status')
  async twoFactorStatus(@CurrentUser() user: AuthUser): Promise<{ enabled: boolean; setup2faRequired: boolean }> {
    const { enabled } = await this.twoFactor.status(user.id);
    return { enabled, setup2faRequired: user.role === Role.ADMIN && !enabled };
  }

  /** Begin enrolment — returns a QR + manual key. Not active until verified. */
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/setup')
  setup2fa(@CurrentUser() user: AuthUser) {
    return this.twoFactor.startSetup(user.id, user.email);
  }

  /** Verify the first code to activate 2FA — returns one-time backup codes. */
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/enable')
  enable2fa(@Body() dto: TwoFactorCodeDto, @CurrentUser() user: AuthUser) {
    return this.twoFactor.enable(user.id, dto.code);
  }

  /** Turn off 2FA after confirming a current code (or backup code). */
  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/disable')
  disable2fa(@Body() dto: TwoFactorCodeDto, @CurrentUser() user: AuthUser) {
    return this.twoFactor.disable(user.id, dto.code);
  }
}
