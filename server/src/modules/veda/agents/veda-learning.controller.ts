import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../../common/auth/decorators';
import type { AuthUser } from '../../../common/auth/auth.types';
import { VedaLearningService } from './veda-learning.service';

@ApiBearerAuth()
@ApiTags('veda-learning')
@Controller('veda/learning')
export class VedaLearningController {
  constructor(private readonly learning: VedaLearningService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.learning.list(status);
  }

  @Get('stats')
  stats() {
    return this.learning.stats();
  }

  @Post(':id/approve')
  @Roles('ADMIN')
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.learning.approve(id, user.id);
  }

  @Post(':id/dismiss')
  @Roles('ADMIN')
  dismiss(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.learning.dismiss(id, user.id);
  }

  /** Manually run the drafting pass (otherwise runs every 30 min via cron). */
  @Post('run')
  @Roles('ADMIN')
  run() {
    return this.learning.draftAnswered();
  }
}
