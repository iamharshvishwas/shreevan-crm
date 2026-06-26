import { Module } from '@nestjs/common';
import { EnquiriesService } from './enquiries.service';
import { IngestionService } from './ingestion.service';
import { ConversionService } from './conversion.service';
import { EnquiriesController } from './enquiries.controller';
import { IntakeController } from './intake.controller';
import { OutboundModule } from '../outbound/outbound.module';

@Module({
  imports: [OutboundModule],
  controllers: [EnquiriesController, IntakeController],
  providers: [EnquiriesService, IngestionService, ConversionService],
  exports: [EnquiriesService, IngestionService],
})
export class EnquiriesModule {}
