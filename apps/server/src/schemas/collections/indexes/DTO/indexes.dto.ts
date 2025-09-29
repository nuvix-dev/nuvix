import { IsString, IsArray, ArrayMaxSize, IsEnum, IsIn } from 'class-validator'
import { IndexType, Order } from '@nuvix/db'
import { configuration } from '@nuvix/utils'
import { ApiProperty } from '@nestjs/swagger'
import { CollectionParamsDTO } from '../../DTO/collection.dto'
import { IsKey } from '@nuvix/core/validators'

export class CreateIndexDTO {
  /**
   * Index Key.
   */
  @IsString()
  @IsKey()
  declare key: string

  /**
   * Index type.
   */
  @ApiProperty({ enum: IndexType })
  @IsEnum(IndexType)
  declare type: IndexType

  /**
   * Array of attributes to index.
   */
  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsString({ each: true })
  declare attributes: string[]

  /**
   * Array of index orders.
   */
  @IsArray()
  @ArrayMaxSize(configuration.limits.arrayParamsSize)
  @IsIn([Order.Asc, Order.Desc, null], { each: true })
  @ApiProperty({ enum: [Order.Asc, Order.Desc, null], isArray: true })
  declare orders: (Order | null)[]
}

// Params

export class IndexParamsDTO extends CollectionParamsDTO {
  /**
   * Index Key.
   */
  @IsKey()
  declare key: string
}
