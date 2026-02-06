import { Type } from 'class-transformer'
import { IsInt, IsPositive } from 'class-validator'

export class FunctionIdParamDTO {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  declare id: number
}
