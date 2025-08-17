import { IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class MaterializedViewIdParamDTO {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  declare id: number;
}
