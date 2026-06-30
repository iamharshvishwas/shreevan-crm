import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../../common/auth/decorators';
import { InstructorService } from './instructor.service';
import { InstructorLoginDto } from './dto/instructor.dto';
import { AuthInstructor, CurrentInstructor, InstructorGuard } from './instructor-auth.guard';

@ApiTags('instructor-auth')
@Controller('instructor/auth')
export class InstructorAuthController {
  constructor(private readonly instructors: InstructorService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: InstructorLoginDto) {
    return this.instructors.login(dto.email, dto.password);
  }

  @Public()
  @ApiBearerAuth()
  @UseGuards(InstructorGuard)
  @Get('me')
  me(@CurrentInstructor() i: AuthInstructor) {
    return i;
  }
}
