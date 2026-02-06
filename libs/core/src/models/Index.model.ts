import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class IndexModel extends BaseModel {
  @Exclude()
  declare $id: string
  @Exclude() declare $permissions: string[]
  /**
   * Index Key.
   */
  @Expose() key = ''

  /**
   * Index type.
   */
  @Expose() type = ''

  /**
   * Index status. Possible values: `available`, `processing`, `deleting`, `stuck`, or `failed`.
   */
  @Expose() status = ''

  /**
   * Error message. Displays error generated on failure of creating or deleting an index.
   */
  @Expose() error = ''

  /**
   * Index attributes.
   */
  @Expose() attributes: string[] = []

  /**
   * Index orders.
   */
  @Expose() orders: string[] = [] // Optional, default to empty array

  constructor(partial: Partial<IndexModel>) {
    super()
    Object.assign(this, partial)
  }
}
