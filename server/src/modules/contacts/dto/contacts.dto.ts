import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { Channel } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListContactsDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
}

export class AddIdentityDto {
  @ApiPropertyOptional({ enum: Channel }) @IsEnum(Channel) channel!: Channel;
  @IsString() handle!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() displayName?: string;
}

export class ReviewMergeDto {
  @ApiPropertyOptional({ enum: ['merge', 'dismiss'] })
  @IsIn(['merge', 'dismiss'])
  decision!: 'merge' | 'dismiss';
}
