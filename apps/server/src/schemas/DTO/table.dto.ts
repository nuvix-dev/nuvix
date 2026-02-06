import { Type } from 'class-transformer'
import { IsNumber, IsOptional, IsString } from 'class-validator'

export class TableParamsDTO {
  /**
   * Schema ID. (See [Schemas](https://docs.nuvix.in/schemas)).
   */
  @IsOptional()
  @IsString()
  schemaId = 'public'

  /**
   * Table ID.
   */
  @IsString()
  declare tableId: string
}

export class FunctionParamsDTO {
  /**
   * Schema ID. (See [Schemas](https://docs.nuvix.in/schemas)).
   */
  @IsOptional()
  @IsString()
  schemaId = 'public'

  /**
   * Function ID.
   */
  @IsString()
  declare functionId: string
}

export class RowParamsDTO extends TableParamsDTO {
  /**
   * Row ID. (See [Schemas](https://docs.nuvix.in/schemas/managed-schema#_id))
   */
  @Type(() => Number)
  @IsNumber()
  declare rowId: number
}
