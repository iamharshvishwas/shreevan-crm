import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsString } from 'class-validator';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { AuthUser } from '../../common/auth/auth.types';
import { StrongPassword } from '../../common/validators/strong-password';

class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() name!: string;
  @IsEnum(Role) role!: Role;
  @StrongPassword() password!: string;
}
class UpdateRoleDto { @IsEnum(Role) role!: Role; }
class SetActiveDto { @IsBoolean() isActive!: boolean; }
class SetPasswordDto { @StrongPassword() password!: string; }

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Active users — for assignment dropdowns (any role). */
  @Get()
  list() {
    return this.users.list();
  }

  /** Full team incl. inactive — admin team management. */
  @Get('manage')
  @Roles(Role.ADMIN)
  manage() {
    return this.users.listAll();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    return this.users.create(dto, actor.id);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto, @CurrentUser() actor: AuthUser) {
    return this.users.updateRole(id, dto.role, actor.id);
  }

  @Patch(':id/active')
  @Roles(Role.ADMIN)
  setActive(@Param('id') id: string, @Body() dto: SetActiveDto, @CurrentUser() actor: AuthUser) {
    return this.users.setActive(id, dto.isActive, actor.id);
  }

  /** Admin resets a user's password (forgot-password for a small team). Revokes
   *  the user's sessions; they sign in with the new password and can change it. */
  @Patch(':id/password')
  @Roles(Role.ADMIN)
  setPassword(@Param('id') id: string, @Body() dto: SetPasswordDto, @CurrentUser() actor: AuthUser) {
    return this.users.adminSetPassword(id, dto.password, actor.id);
  }
}
