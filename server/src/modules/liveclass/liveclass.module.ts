import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LiveClassController } from './liveclass.controller';
import { LiveClassService } from './liveclass.service';
import { HmsService } from './hms.service';
import { ParticipantAuthController } from './participant/participant-auth.controller';
import { ParticipantAuthService } from './participant/participant-auth.service';
import { ParticipantGuard } from './participant/participant-auth.guard';
import { InstructorAuthController } from './instructor/instructor-auth.controller';
import { InstructorAdminController } from './instructor/instructor-admin.controller';
import { InstructorService } from './instructor/instructor.service';
import { InstructorGuard } from './instructor/instructor-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [
    LiveClassController,
    ParticipantAuthController,
    InstructorAuthController,
    InstructorAdminController,
  ],
  providers: [
    LiveClassService,
    HmsService,
    ParticipantAuthService,
    ParticipantGuard,
    InstructorService,
    InstructorGuard,
  ],
})
export class LiveClassModule {}
