import { ApiProperty } from '@nestjs/swagger';
import { LiveClassMode } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLiveClassDto {
  @ApiProperty({ example: 'cloud101' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ required: false, enum: LiveClassMode, description: 'WEBINAR (view-only + raise hand) or MEETING (everyone can talk)' })
  @IsOptional()
  @IsEnum(LiveClassMode)
  mode?: LiveClassMode;

  @ApiProperty({ required: false, description: 'ISO date-time' })
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}
