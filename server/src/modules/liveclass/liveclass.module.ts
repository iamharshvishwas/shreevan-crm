import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LiveClassController } from './liveclass.controller';
import { LiveClassService } from './liveclass.service';
import { HmsService } from './hms.service';
import { ParticipantAuthController } from './participant/participant-auth.controller';
import { ParticipantAuthService } from './participant/participant-auth.service';
import { ParticipantGuard } from './participant/participant-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [LiveClassController, ParticipantAuthController],
  providers: [LiveClassService, HmsService, ParticipantAuthService, ParticipantGuard],
})
export class LiveClassModule {}
