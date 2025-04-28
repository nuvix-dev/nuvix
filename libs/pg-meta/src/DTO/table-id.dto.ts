import { IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class TableIdParamDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  id: number;
}
