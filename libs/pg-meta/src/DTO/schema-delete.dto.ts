import { IsBoolean, IsOptional } from 'class-validator';

export class SchemaDeleteQueryDto {
  @IsOptional()
  @IsBoolean()
  cascade?: boolean;
}
