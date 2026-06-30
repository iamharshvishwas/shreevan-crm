import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { StrongPassword } from '../../../../common/validators/strong-password';

export class ParticipantSignupDto {
  @ApiProperty({ example: 'learner@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Asha Verma' })
  @IsString()
  @MinLength(2, { message: 'Please enter your name.' })
  @MaxLength(80)
  name!: string;

  @ApiProperty({ example: 'a-strong-pass-123' })
  @StrongPassword()
  password!: string;
}

export class ParticipantLoginDto {
  @ApiProperty({ example: 'learner@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}
