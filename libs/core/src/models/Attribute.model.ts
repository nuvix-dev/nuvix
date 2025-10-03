import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from '@nuvix/core/models/base.model'

import type { Attributes } from '@nuvix/utils/types'

// TODO: improve this model to support all options of Attribute
@Exclude()
export class AttributeModel extends BaseModel implements Partial<Attributes> {
  @Exclude() declare $permissions: string[]
  /**
   * Attribute Key.
   */
  @Expose() key: string = ''

  /**
   * Attribute type.
   */
  @Expose() type: string = ''

  /**
   * Attribute status. Possible values: `available`, `processing`, `deleting`, `stuck`, or `failed`.
   */
  @Expose() status: string = 'available'

  /**
   * Error message. Displays error generated on failure of creating or deleting an attribute.
   */
  @Expose() error: string = ''

  /**
   * Is attribute required?
   */
  @Expose() required: boolean = false

  /**
   * Is attribute an array?
   */
  @Expose() array: boolean = false

  constructor(partial: Partial<AttributeModel>) {
    super()
    Object.assign(this, partial)
  }
}
