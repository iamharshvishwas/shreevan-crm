import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { StrongPassword } from '../../../../common/validators/strong-password';

export class InstructorLoginDto {
  @ApiProperty({ example: 'teacher@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}

/** Admin creates an instructor account (no self-signup). */
export class CreateInstructorDto {
  @ApiProperty({ example: 'Ravi Sharma' })
  @IsString()
  @MinLength(2, { message: 'Please enter the instructor name.' })
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'teacher@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'a-strong-pass-123' })
  @StrongPassword()
  password!: string;
}

/** Admin updates an instructor: toggle active and/or reset password. */
export class UpdateInstructorDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @StrongPassword()
  password?: string;
}
