import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LiveClassService } from './liveclass.service';
import { CreateLiveClassDto } from './dto/liveclass.dto';
import { CurrentUser, Public } from '../../common/auth/decorators';
import type { AuthUser } from '../../common/auth/auth.types';
import { AuthParticipant, CurrentParticipant, ParticipantGuard } from './participant/participant-auth.guard';

@ApiTags('live-classes')
@Controller('liveclass')
export class LiveClassController {
  constructor(private readonly classes: LiveClassService) {}

  // ---- Host (staff — global JWT guard) ----

  @ApiBearerAuth()
  @Post()
  create(@Body() dto: CreateLiveClassDto, @CurrentUser() user: AuthUser) {
    return this.classes.create(user, dto);
  }

  @ApiBearerAuth()
  @Get('host')
  listForHost(@CurrentUser() user: AuthUser) {
    return this.classes.listForHost(user);
  }

  @ApiBearerAuth()
  @Post(':id/start')
  start(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.classes.start(id, user);
  }

  @ApiBearerAuth()
  @Post(':id/end')
  end(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.classes.end(id, user);
  }

  @ApiBearerAuth()
  @Post(':id/host-token')
  hostToken(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.classes.hostToken(id, user);
  }

  // ---- Participant (public route, participant token) ----

  @Public()
  @ApiBearerAuth()
  @UseGuards(ParticipantGuard)
  @Get('joinable')
  joinable() {
    return this.classes.listJoinable();
  }

  @Public()
  @ApiBearerAuth()
  @UseGuards(ParticipantGuard)
  @Post(':slug/join')
  join(@Param('slug') slug: string, @CurrentParticipant() p: AuthParticipant) {
    return this.classes.joinAsParticipant(slug, p);
  }
}
