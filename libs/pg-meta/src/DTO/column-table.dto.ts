import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class ColumnTableParams {
  @IsNumber()
  @Type(() => Number)
  tableId: number;

  @IsOptional()
  @IsString()
  ordinalPosition?: string;
}
