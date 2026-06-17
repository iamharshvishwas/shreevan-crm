import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;

  @ApiPropertyOptional({ description: 'Free-text search' })
  @IsOptional()
  @IsString()
  q?: string;

  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginate<T>(data: T[], total: number, dto: PaginationDto): Paginated<T> {
  return {
    data,
    page: dto.page,
    pageSize: dto.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / dto.pageSize)),
  };
}
