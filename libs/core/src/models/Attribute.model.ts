import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from '@nuvix/core/models/base.model'
import type { Attributes } from '@nuvix/utils/types'
import { AttributeType, OnDelete, RelationSide, RelationType } from '@nuvix/db'
import { AttributeFormat } from '@nuvix/utils'

@Exclude()
export class AttributeModel
  extends BaseModel
  implements Partial<Omit<Attributes, 'default'>>
{
  @Exclude() declare $permissions: string[]
  /**
   * Attribute Key.
   */
  @Expose() declare key: string

  /**
   * Attribute type.
   */
  @Expose() declare type: AttributeType

  /**
   * Attribute status. Possible values: `available`, `processing`, `deleting`, `stuck`, or `failed`.
   */
  @Expose() status: string = 'available'

  /**
   * Error message. Displays error generated on failure of creating or deleting an attribute.
   */
  @Expose() error?: string

  /**
   * Is attribute required?
   */
  @Expose() required: boolean = false

  /**
   * Is attribute an array?
   */
  @Expose() array: boolean = false

  /**
   * Attribute default value.
   */
  @Expose() declare default?: boolean | string | number | null

  /**
   *  Attribute format.
   */
  @Expose() format?: AttributeFormat

  /**
   * Enum elements (for enum type only).
   */
  @Expose() elements?: string[]

  /**
   * Numeric attribute options.
   */
  @Expose() min?: number | null

  /**
   * Numeric attribute options.
   */
  @Expose() max?: number | null

  /**
   * Attribute size (for string).
   */
  @Expose() size?: number

  /**
   * Related collection ID (for relationship type only).
   */
  @Expose() relatedCollection?: string | null

  /**
   * Relation type, possible values are: `oneToOne`, `oneToMany`, `manyToOne`, `manyToMany` (for relationship type only).
   */
  @Expose() relationType?: RelationType

  /**
   * Indicates whether the relationship is two-way (for relationship type only).
   */
  @Expose() twoWay?: boolean

  /**
   * Two-way attribute key (for relationship type only).
   */
  @Expose() twoWayKey?: string

  /**
   * On delete action, possible values are: `cascade`, `restrict`, or `setNull` (for relationship type only).
   */
  @Expose() onDelete?: OnDelete

  /**
   * Attribute side (for relationship type only).
   * Possible values are `parent` or `child`.
   */
  @Expose() side?: RelationSide

  constructor(partial: Partial<AttributeModel>) {
    super()
    Object.assign(this, partial)
  }
}
