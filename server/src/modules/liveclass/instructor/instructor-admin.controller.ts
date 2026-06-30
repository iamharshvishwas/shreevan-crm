import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../../common/auth/decorators';
import { InstructorService } from './instructor.service';
import { CreateInstructorDto, UpdateInstructorDto } from './dto/instructor.dto';

/** Admin-only management of instructor accounts (runs under the global staff
 *  JWT guard; RolesGuard enforces ADMIN). */
@ApiTags('instructors-admin')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('instructors')
export class InstructorAdminController {
  constructor(private readonly instructors: InstructorService) {}

  @Post()
  create(@Body() dto: CreateInstructorDto) {
    return this.instructors.adminCreate(dto.name, dto.email, dto.password);
  }

  @Get()
  list() {
    return this.instructors.adminList();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInstructorDto) {
    return this.instructors.adminUpdate(id, dto);
  }
}
