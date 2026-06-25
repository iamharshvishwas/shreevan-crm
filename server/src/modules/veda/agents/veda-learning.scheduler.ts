import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VedaConfigService } from '../veda-config.service';
import { VedaLearningService } from './veda-learning.service';

/**
 * Drives Veda's self-learning loop: turns answered knowledge gaps into knowledge
 * (auto-applying safe ones, queueing sensitive ones). Detection + answer capture
 * happen inline on each conversation; this just does the periodic drafting.
 */
@Injectable()
export class VedaLearningScheduler {
  private readonly logger = new Logger(VedaLearningScheduler.name);

  constructor(
    private readonly config: VedaConfigService,
    private readonly learning: VedaLearningService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async tick(): Promise<void> {
    if (!(await this.config.isGloballyEnabled())) return;
    if (!(await this.config.isStepEnabled('SELF_LEARN'))) return;
    try {
      await this.learning.draftAnswered();
    } catch (e) {
      this.logger.warn(`learning tick failed: ${(e as Error).message}`);
    }
  }
}
