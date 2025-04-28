import { IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class PublicationQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  offset?: number;
}
