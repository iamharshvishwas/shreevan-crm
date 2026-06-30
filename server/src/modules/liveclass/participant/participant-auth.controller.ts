import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/auth/decorators';
import { ParticipantAuthService } from './participant-auth.service';
import { ParticipantLoginDto, ParticipantSignupDto } from './dto/participant-auth.dto';
import { AuthParticipant, CurrentParticipant, ParticipantGuard } from './participant-auth.guard';

@ApiTags('participant-auth')
@Controller('participant/auth')
export class ParticipantAuthController {
  constructor(private readonly auth: ParticipantAuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup')
  signup(@Body() dto: ParticipantSignupDto) {
    return this.auth.signup(dto.email, dto.name, dto.password);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: ParticipantLoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  /** Returns the signed-in participant (used by the client to restore session). */
  @Public()
  @ApiBearerAuth()
  @UseGuards(ParticipantGuard)
  @Get('me')
  me(@CurrentParticipant() p: AuthParticipant) {
    return p;
  }
}
