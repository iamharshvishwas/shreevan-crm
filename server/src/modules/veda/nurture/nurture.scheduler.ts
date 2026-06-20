import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VedaConfigService } from '../veda-config.service';
import { NurtureService } from './nurture.service';

@Injectable()
export class NurtureScheduler {
  private readonly logger = new Logger(NurtureScheduler.name);

  constructor(
    private readonly config: VedaConfigService,
    private readonly nurture: NurtureService,
  ) {}

  // Runs a few times an hour — nurture offsets are in hours, so this is plenty.
  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick(): Promise<void> {
    if (!(await this.config.isGloballyEnabled())) return;
    if (!(await this.config.isStepEnabled('NURTURE'))) return;

    const enrolled = await this.nurture.enrollEligible();
    await this.nurture.runDue();
    if (enrolled) this.logger.debug(`Nurture enrolled ${enrolled} lead(s)`);
  }
}
