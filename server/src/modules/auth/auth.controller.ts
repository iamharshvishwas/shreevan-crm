import { Body, Controller, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshDto, TokensDto } from './dto/auth.dto';
import { CurrentUser, Public } from '../../common/auth/decorators';
import { AuthUser } from '../../common/auth/auth.types';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private meta(req: Request) {
    return { ip: req.ip, userAgent: req.headers['user-agent'] };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<TokensDto> {
    return this.auth.login(dto.email, dto.password, this.meta(req));
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
}
