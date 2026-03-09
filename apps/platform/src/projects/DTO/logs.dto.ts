import { ArrayToLastElement, TryTransformTo } from '@nuvix/core/validators'
import { IsNumber, IsOptional, IsString } from 'class-validator'

export class LogsQueryDTO {
  /**
   * Filter to apply on the table.
   */
  @IsOptional()
  @ArrayToLastElement()
  @IsString()
  filter?: string

  /**
   * Order to apply on the table.
   */
  @IsOptional()
  @ArrayToLastElement()
  @IsString()
  order?: string

  /**
   * Columns to select from the table.
   */
  @IsOptional()
  @ArrayToLastElement()
  @IsString()
  select?: string

  /**
   * Limit the number of rows returned.
   */
  @IsOptional()
  @ArrayToLastElement()
  @TryTransformTo('int')
  @IsNumber()
  limit?: number

  /**
   * Offset for pagination.
   */
  @IsOptional()
  @ArrayToLastElement()
  @TryTransformTo('int')
  @IsNumber()
  offset?: number
}
