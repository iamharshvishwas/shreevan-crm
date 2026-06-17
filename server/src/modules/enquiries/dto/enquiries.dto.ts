import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum, IsInt, IsISO8601, IsOptional, IsPositive, IsString,
} from 'class-validator';
import { Channel, Currency, EnquiryStatus, Priority, Temperature } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export type EnquiryView =
  | 'needs_reply' | 'unassigned' | 'waiting_for_customer' | 'sla_breached' | 'all';

export class ListEnquiriesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['needs_reply', 'unassigned', 'waiting_for_customer', 'sla_breached', 'all'] })
  @IsOptional() @IsString() view?: EnquiryView;

  @ApiPropertyOptional({ enum: Channel }) @IsOptional() @IsEnum(Channel) channel?: Channel;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerId?: string;
  @ApiPropertyOptional({ enum: Priority }) @IsOptional() @IsEnum(Priority) priority?: Priority;
}

export class AssignDto {
  @ApiProperty() @IsString() ownerId!: string;
}

export class SetStatusDto {
  @ApiProperty({ enum: EnquiryStatus }) @IsEnum(EnquiryStatus) status!: EnquiryStatus;
}

export class AddNoteDto {
  @ApiProperty() @IsString() body!: string;
}

export class ResponseDto {
  @ApiProperty() @IsString() body!: string;
}

export class ConvertToLeadDto {
  @ApiPropertyOptional({ description: 'Link to this existing lead instead of creating a new one' })
  @IsOptional() @IsString() linkExistingLeadId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() ownerId?: string;
  @ApiProperty() @IsString() nextAction!: string;
  @ApiProperty() @IsISO8601() nextActionDate!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() programInterest?: string;
  @ApiPropertyOptional({ enum: Temperature }) @IsOptional() @IsEnum(Temperature) temperature?: Temperature;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @IsPositive() expectedValueAmount?: number;
  @ApiPropertyOptional({ enum: Currency }) @IsOptional() @IsEnum(Currency) expectedValueCurrency?: Currency;
}

export class ManualEnquiryDto {
  @ApiProperty() @IsString() name!: string;
  @ApiProperty({ enum: Channel, default: Channel.PHONE }) @IsEnum(Channel) channel!: Channel;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiProperty() @IsString() message!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() programInterest?: string;
}

export class CreateTaskDto {
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional({ default: 'Follow-up' }) @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() dueAt?: string;
}

export class ScheduleCallDto {
  @ApiProperty() @IsISO8601() scheduledAt!: string;
  @ApiProperty({ example: 'Asia/Kolkata' }) @IsString() timezone!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() prepNotes?: string;
}

export class WebsiteEnquiryDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiProperty() @IsString() message!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() programInterest?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() formId?: string;
}
