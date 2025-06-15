import { IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class FunctionIdParamDTO {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  id: number;
}
