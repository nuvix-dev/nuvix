import { Type } from 'class-transformer'
import { IsInt, IsPositive } from 'class-validator'

export class IndexIdParamDTO {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  declare id: number
}
