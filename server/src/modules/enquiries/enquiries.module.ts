import { Module } from '@nestjs/common';
import { EnquiriesService } from './enquiries.service';
import { IngestionService } from './ingestion.service';
import { ConversionService } from './conversion.service';
import { EnquiriesController } from './enquiries.controller';
import { IntakeController } from './intake.controller';

@Module({
  controllers: [EnquiriesController, IntakeController],
  providers: [EnquiriesService, IngestionService, ConversionService],
  exports: [EnquiriesService, IngestionService],
})
export class EnquiriesModule {}
