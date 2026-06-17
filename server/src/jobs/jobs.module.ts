import { Module } from '@nestjs/common';
import { SlaScheduler } from './sla.scheduler';

@Module({ providers: [SlaScheduler] })
export class JobsModule {}
