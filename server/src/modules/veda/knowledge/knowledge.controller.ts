import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { Roles } from '../../../common/auth/decorators';
import { KnowledgeService } from './knowledge.service';

class KnowledgeDto {
  @IsString() title!: string;
  @IsString() content!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

class UpdateKnowledgeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() content?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

@ApiBearerAuth()
@ApiTags('veda-knowledge')
@Controller('veda/knowledge')
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  list() {
    return this.knowledge.list();
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: KnowledgeDto) {
    return this.knowledge.create(dto);
  }

  @Post('import-programs')
  @Roles('ADMIN')
  importPrograms() {
    return this.knowledge.importPrograms();
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateKnowledgeDto) {
    return this.knowledge.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.knowledge.remove(id);
  }
}
