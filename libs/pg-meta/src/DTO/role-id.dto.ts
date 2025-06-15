import { IsInt, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class RoleIdParamDTO {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  id: number;
}
