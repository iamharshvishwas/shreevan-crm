import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsEnum, IsISO8601, IsObject, IsOptional, IsString, ValidateNested,
} from 'class-validator';
import { Channel } from '@prisma/client';

class SenderDto {
  @IsString() providerIdentityId!: string;
  @IsString() displayName!: string;
  @IsOptional() @IsString() email!: string | null;
  @IsOptional() @IsString() phone!: string | null;
}

class AttachmentDto {
  @IsString() name!: string;
  @IsString() kind!: string;
}

class MessageDto {
  @IsString() type!: string;
  @IsString() text!: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

class AttributionDto {
  @IsEnum(Channel) firstTouchSource!: Channel;
  @IsOptional() @IsString() campaign!: string | null;
}

/** The normalized inbound-event contract every adapter emits. */
export class NormalizedInboundEvent {
  @ApiProperty({ enum: Channel }) @IsEnum(Channel) provider!: Channel;
  @IsString() connectionId!: string;
  @IsString() externalEventId!: string;
  @IsString() externalConversationId!: string;
  @IsString() externalMessageId!: string;
  @ApiProperty({ enum: ['inbound'] }) @IsString() direction!: 'inbound';

  @ValidateNested() @Type(() => SenderDto) sender!: SenderDto;
  @ValidateNested() @Type(() => MessageDto) message!: MessageDto;
  @ValidateNested() @Type(() => AttributionDto) attribution!: AttributionDto;

  @IsISO8601() occurredAt!: string;

  @ApiPropertyOptional() @IsOptional() @IsObject() rawPayload?: Record<string, unknown>;
}
