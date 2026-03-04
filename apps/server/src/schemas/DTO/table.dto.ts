import { PickType } from '@nestjs/swagger'
import {
  ArrayToLastElement,
  TransformStringToBoolean,
  TryTransformTo,
} from '@nuvix/core/validators'
import { Type } from 'class-transformer'
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator'

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

export class InsertQueryDTO extends PickType(SelectQueryDTO, [
  'select',
] as const) {
  /**
   * Columns to insert into. (See [Schemas](https://docs.nuvix.in/schemas/managed-schema#inserting-data)
   */
  @IsOptional()
  @ArrayToLastElement()
  @IsString()
  columns?: string[]
}

export class UpdateQueryDTO extends SelectQueryDTO {
  /**
   * Columns to update. (See [Schemas](https://docs.nuvix.in/schemas/managed-schema#updating-data)
   */
  @IsOptional()
  @ArrayToLastElement()
  @IsString()
  columns?: string[]

  /**
   * When false, if the update query does not have a filter, it will throw an error to prevent accidental updates to all rows. Set to true to force the update without a filter. (See [Schemas](https://docs.nuvix.in/schemas/managed-schema#updating-data)
   */
  @IsOptional()
  @ArrayToLastElement()
  @TransformStringToBoolean()
  @IsBoolean()
  force?: boolean = false
}

export class DeleteQueryDTO extends SelectQueryDTO {
  /**
   * When false, if the delete query does not have a filter, it will throw an error to prevent accidental deletion of all rows. Set to true to force the delete without a filter. (See [Schemas](https://docs.nuvix.in/schemas/managed-schema#deleting-data)
   */
  @IsOptional()
  @ArrayToLastElement()
  @TransformStringToBoolean()
  @IsBoolean()
  force?: boolean = false
}

export class CallFunctionQueryDTO extends SelectQueryDTO {}
