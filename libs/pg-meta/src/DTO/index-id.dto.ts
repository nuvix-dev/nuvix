import { IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class IndexIdParamDTO {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  id: number;
}
