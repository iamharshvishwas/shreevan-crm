import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength, MinLength } from 'class-validator';

export class PostMessageDto {
  @ApiProperty({ example: 'Great session!' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  body!: string;
}

export class CreatePollDto {
  @ApiProperty({ example: 'Which topic next?' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  question!: string;

  @ApiProperty({ example: ['Networking', 'Storage', 'Security'] })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  options!: string[];
}

export class VoteDto {
  @ApiProperty()
  @IsString()
  optionId!: string;
}
