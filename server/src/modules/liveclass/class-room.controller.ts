import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/decorators';
import { ChatService } from './chat.service';
import { PollService } from './poll.service';
import { LiveClassService } from './liveclass.service';
import { PostMessageDto, CreatePollDto, VoteDto } from './dto/room.dto';
import { ClassMember, ClassMemberGuard, CurrentMember } from './class-member.guard';
import { AuthInstructor, CurrentInstructor, InstructorGuard } from './instructor/instructor-auth.guard';
import { AuthParticipant, CurrentParticipant, ParticipantGuard } from './participant/participant-auth.guard';

/** In-room chat + polls. Reads are shared (host or learner); writes are scoped:
 *  anyone posts chat, only the host runs polls, only learners vote. */
@ApiTags('class-room')
@Controller('liveclass/:id')
export class ClassRoomController {
  constructor(
    private readonly chat: ChatService,
    private readonly polls: PollService,
    private readonly classes: LiveClassService,
  ) {}

  /** Lets a room poll for "has the host ended this class?" — shown as a popup. */
  @Public()
  @ApiBearerAuth()
  @UseGuards(ClassMemberGuard)
  @Get('status')
  status(@Param('id') id: string) {
    return this.classes.status(id);
  }

  // ---- Chat (both roles) ----

  @Public()
  @ApiBearerAuth()
  @UseGuards(ClassMemberGuard)
  @Get('messages')
  listMessages(@Param('id') id: string) {
    return this.chat.list(id);
  }

  @Public()
  @ApiBearerAuth()
  @UseGuards(ClassMemberGuard)
  @Post('messages')
  postMessage(@Param('id') id: string, @Body() dto: PostMessageDto, @CurrentMember() member: ClassMember) {
    return this.chat.post(id, member, dto.body);
  }

  // ---- Poll: read (both roles) ----

  @Public()
  @ApiBearerAuth()
  @UseGuards(ClassMemberGuard)
  @Get('poll')
  getPoll(@Param('id') id: string, @CurrentMember() member: ClassMember) {
    return this.polls.current(id, member.kind === 'participant' ? member.id : undefined);
  }

  // ---- Poll: host runs it ----

  @Public()
  @ApiBearerAuth()
  @UseGuards(InstructorGuard)
  @Post('poll')
  createPoll(@Param('id') id: string, @Body() dto: CreatePollDto, @CurrentInstructor() host: AuthInstructor) {
    return this.polls.create(id, host, dto.question, dto.options);
  }

  @Public()
  @ApiBearerAuth()
  @UseGuards(InstructorGuard)
  @Post('poll/close')
  closePoll(@Param('id') id: string, @CurrentInstructor() host: AuthInstructor) {
    return this.polls.close(id, host);
  }

  // ---- Poll: learner votes ----

  @Public()
  @ApiBearerAuth()
  @UseGuards(ParticipantGuard)
  @Post('poll/vote')
  vote(@Param('id') id: string, @Body() dto: VoteDto, @CurrentParticipant() p: AuthParticipant) {
    return this.polls.vote(id, p.id, dto.optionId);
  }
}
