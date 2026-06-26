import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { StrongPassword } from '../../../common/validators/strong-password';

export class LoginDto {
  @ApiProperty({ example: 'isha@shreevanwellness.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'changeme123' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  @ApiProperty({ minLength: 10, description: 'Min 10 chars, must include a letter and a number.' })
  @StrongPassword()
  newPassword!: string;
}

export class TokensDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty() expiresIn!: number;
}
