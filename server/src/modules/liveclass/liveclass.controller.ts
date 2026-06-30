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
