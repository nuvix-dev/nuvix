import { IsBoolean, IsOptional } from 'class-validator';

export class ColumnDeleteQueryDto {
  @IsOptional()
  @IsBoolean()
  cascade?: boolean;
}
