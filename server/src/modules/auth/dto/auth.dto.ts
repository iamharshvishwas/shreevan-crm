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
  /** True for an admin who has not yet enrolled in 2FA (frontend forces setup). */
  @ApiProperty({ required: false }) setup2faRequired?: boolean;
}

/** Returned by /auth/login when the account has 2FA on — exchange via /auth/2fa/verify. */
export class TwoFactorChallengeDto {
  @ApiProperty({ example: true }) twoFactorRequired!: true;
  @ApiProperty() challengeToken!: string;
}

export type LoginResult = TokensDto | TwoFactorChallengeDto;

export class TwoFactorVerifyDto {
  @ApiProperty()
  @IsString()
  challengeToken!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  code!: string;
}

export class TwoFactorCodeDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  code!: string;
}
