import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LiveClassService } from './liveclass.service';
import { CreateLiveClassDto } from './dto/liveclass.dto';
import { Public } from '../../common/auth/decorators';
import { AuthInstructor, CurrentInstructor, InstructorGuard } from './instructor/instructor-auth.guard';
import { AuthParticipant, CurrentParticipant, ParticipantGuard } from './participant/participant-auth.guard';

@ApiTags('live-classes')
@Controller('liveclass')
export class LiveClassController {
  constructor(private readonly classes: LiveClassService) {}

  // ---- Host (instructor token) ----

  @Public()
  @ApiBearerAuth()
  @UseGuards(InstructorGuard)
  @Post()
  create(@Body() dto: CreateLiveClassDto, @CurrentInstructor() host: AuthInstructor) {
    return this.classes.create(host, dto);
  }

  @Public()
  @ApiBearerAuth()
  @UseGuards(InstructorGuard)
  @Get('host')
  listForHost(@CurrentInstructor() host: AuthInstructor) {
    return this.classes.listForHost(host);
  }

  @Public()
  @ApiBearerAuth()
  @UseGuards(InstructorGuard)
  @Post(':id/start')
  start(@Param('id') id: string, @CurrentInstructor() host: AuthInstructor) {
    return this.classes.start(id, host);
  }

  @Public()
  @ApiBearerAuth()
  @UseGuards(InstructorGuard)
  @Post(':id/end')
  end(@Param('id') id: string, @CurrentInstructor() host: AuthInstructor) {
    return this.classes.end(id, host);
  }

  @Public()
  @ApiBearerAuth()
  @UseGuards(InstructorGuard)
  @Post(':id/host-token')
  hostToken(@Param('id') id: string, @CurrentInstructor() host: AuthInstructor) {
    return this.classes.hostToken(id, host);
  }

  // ---- Waiting room + activity (host) ----

  @Public()
  @ApiBearerAuth()
  @UseGuards(InstructorGuard)
  @Get(':id/join-requests')
  joinRequests(@Param('id') id: string, @CurrentInstructor() host: AuthInstructor) {
    return this.classes.listJoinRequests(id, host);
  }

  @Public()
  @ApiBearerAuth()
  @UseGuards(InstructorGuard)
  @Post(':id/join-requests/:reqId/approve')
  approveJoin(@Param('id') id: string, @Param('reqId') reqId: string, @CurrentInstructor() host: AuthInstructor) {
    return this.classes.decideJoinRequest(id, reqId, host, true);
  }

  @Public()
  @ApiBearerAuth()
  @UseGuards(InstructorGuard)
  @Post(':id/join-requests/:reqId/deny')
  denyJoin(@Param('id') id: string, @Param('reqId') reqId: string, @CurrentInstructor() host: AuthInstructor) {
    return this.classes.decideJoinRequest(id, reqId, host, false);
  }

  @Public()
  @ApiBearerAuth()
  @UseGuards(InstructorGuard)
  @Get(':id/activity')
  activity(@Param('id') id: string, @CurrentInstructor() host: AuthInstructor) {
    return this.classes.activity(id, host);
  }

  // ---- Participant (participant token) ----

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
