import { Type } from 'class-transformer'
import { IsInt, IsPositive } from 'class-validator'

export class ViewIdParamDTO {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  declare id: number
}
