import { ArrayToLastElement, TryTransformTo } from '@nuvix/core/validators'
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

export class SelectQueryDTO {
  /**
   * Filter to apply on the table. (See [Schemas](https://docs.nuvix.in/schemas/managed-schema#filtering)
   */
  @IsOptional()
  @ArrayToLastElement()
  @IsString()
  filter?: string

  /**
   * Order to apply on the table. (See [Schemas](https://docs.nuvix.in/schemas/managed-schema#ordering)
   */
  @IsOptional()
  @ArrayToLastElement()
  @IsString()
  order?: string

  /**
   * Columns to select from the table. (See [Schemas](https://docs.nuvix.in/schemas/managed-schema#selecting-columns)
   */
  @IsOptional()
  @ArrayToLastElement()
  @IsString()
  select?: string

  /**
   * Limit the number of rows returned. (See [Schemas](https://docs.nuvix.in/schemas/managed-schema#pagination)
   */
  @IsOptional()
  @ArrayToLastElement()
  @TryTransformTo('int')
  @IsNumber()
  limit?: number

  /**
   * Offset for pagination. (See [Schemas](https://docs.nuvix.in/schemas/managed-schema#pagination)
   */
  @IsOptional()
  @ArrayToLastElement()
  @TryTransformTo('int')
  @IsNumber()
  offset?: number
}
