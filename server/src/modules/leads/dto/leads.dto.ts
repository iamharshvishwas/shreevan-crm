import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Currency, PaymentStatus, Temperature } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export type LeadView = 'active' | 'hot' | 'no_next_action' | 'payment_pending' | 'closed_lost' | 'all';

export class ListLeadsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['active', 'hot', 'no_next_action', 'payment_pending', 'closed_lost', 'all'] })
  @IsOptional() @IsString() view?: LeadView;

  @ApiPropertyOptional() @IsOptional() @IsString() stageKey?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerId?: string;
}

export class MoveStageDto {
  @ApiProperty({ example: 'offer_sent' }) @IsString() toStageKey!: string;
}

export class NextActionDto {
  @ApiProperty() @IsString() nextAction!: string;
  @ApiProperty() @IsISO8601() nextActionDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerId?: string;
}

export class ConfirmBookingDto {
  @ApiPropertyOptional({ enum: PaymentStatus, default: PaymentStatus.DEPOSIT })
  @IsOptional() @IsEnum(PaymentStatus) paymentStatus?: PaymentStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() cohortId?: string;
  @ApiPropertyOptional({ enum: Currency }) @IsOptional() @IsEnum(Currency) valueCurrency?: Currency;
}

export class CloseLostDto {
  @ApiProperty({ example: 'timing' }) @IsString() reasonKey!: string;
}

export class UpdateLeadDto {
  @ApiPropertyOptional({ enum: Temperature }) @IsOptional() @IsEnum(Temperature) temperature?: Temperature;
  @ApiPropertyOptional() @IsOptional() @IsString() ownerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() programInterest?: string;
}
