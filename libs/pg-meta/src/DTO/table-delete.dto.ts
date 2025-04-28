import { IsBoolean, IsOptional } from 'class-validator';

export class TableDeleteQueryDto {
  @IsOptional()
  @IsBoolean()
  cascade?: boolean;
}
