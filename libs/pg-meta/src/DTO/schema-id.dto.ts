import { IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class SchemaIdParamDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  id: number;
}
