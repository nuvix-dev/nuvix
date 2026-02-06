import { Type } from 'class-transformer'
import { IsInt, IsPositive } from 'class-validator'

export class MaterializedViewIdParamDTO {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  declare id: number
}
