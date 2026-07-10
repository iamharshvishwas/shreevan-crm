import { Controller, Get } from '@nestjs/common';
import { RequireScreens } from '../../common/auth/decorators';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PipelineService } from './pipeline.service';

@ApiTags('pipeline')
@ApiBearerAuth()
@Controller('pipeline')
@RequireScreens('pipeline')
export class PipelineController {
  constructor(private readonly pipeline: PipelineService) {}

  @Get('stages')
  stages() {
    return this.pipeline.stages();
  }

  @Get('board')
  board() {
    return this.pipeline.board();
  }

  @Get('lost-reasons')
  lostReasons() {
    return this.pipeline.lostReasons();
  }
}
