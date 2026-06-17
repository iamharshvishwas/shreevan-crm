import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EnquiriesService } from './enquiries.service';
import { ConversionService } from './conversion.service';
import {
  AddNoteDto, AssignDto, ConvertToLeadDto, CreateTaskDto, ListEnquiriesDto,
  ResponseDto, ScheduleCallDto, SetStatusDto,
} from './dto/enquiries.dto';
import { CurrentUser } from '../../common/auth/decorators';
import { AuthUser } from '../../common/auth/auth.types';

@ApiTags('enquiries')
@ApiBearerAuth()
@Controller('enquiries')
export class EnquiriesController {
  constructor(
    private readonly enquiries: EnquiriesService,
    private readonly conversion: ConversionService,
  ) {}

  @Get()
  list(@Query() dto: ListEnquiriesDto) {
    return this.enquiries.list(dto);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.enquiries.get(id);
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignDto, @CurrentUser() user: AuthUser) {
    return this.enquiries.assign(id, dto.ownerId, user.id);
  }

  @Post(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto, @CurrentUser() user: AuthUser) {
    return this.enquiries.setStatus(id, dto.status, user.id);
  }

  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() dto: AddNoteDto, @CurrentUser() user: AuthUser) {
    return this.enquiries.addNote(id, dto, user);
  }

  @Post(':id/responses')
  respond(@Param('id') id: string, @Body() dto: ResponseDto, @CurrentUser() user: AuthUser) {
    return this.enquiries.respond(id, dto, user);
  }

  @Post(':id/tasks')
  createTask(@Param('id') id: string, @Body() dto: CreateTaskDto, @CurrentUser() user: AuthUser) {
    return this.enquiries.createTask(id, dto, user.id);
  }

  @Post(':id/discovery-calls')
  scheduleCall(@Param('id') id: string, @Body() dto: ScheduleCallDto, @CurrentUser() user: AuthUser) {
    return this.enquiries.scheduleCall(id, dto, user.id);
  }

  @Get(':id/duplicate-leads')
  duplicates(@Param('id') id: string) {
    return this.conversion.duplicateLeads(id);
  }

  @Post(':id/convert-to-lead')
  convert(@Param('id') id: string, @Body() dto: ConvertToLeadDto, @CurrentUser() user: AuthUser) {
    return this.conversion.convert(id, dto, user.id);
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.enquiries.setStatus(id, 'RESOLVED', user.id);
  }
}
