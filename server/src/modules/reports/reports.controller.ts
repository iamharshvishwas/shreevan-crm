import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('overview')
  overview() {
    return this.reports.overview();
  }

  @Get('analytics')
  analytics() {
    return this.reports.analytics();
  }

  @Get('channels')
  channels() {
    return this.reports.channels();
  }
}
