import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { RequireScreens } from '../../common/auth/decorators';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';
import { TasksService } from './tasks.service';

class CreateTaskDto {
  @IsString() title!: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsISO8601() dueAt?: string;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() contactId?: string;
}

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
@RequireScreens('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(@Query('ownerId') ownerId?: string) {
    return this.tasks.list(ownerId);
  }

  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.tasks.create(dto);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.tasks.setDone(id, true);
  }

  @Post(':id/reopen')
  reopen(@Param('id') id: string) {
    return this.tasks.setDone(id, false);
  }
}
