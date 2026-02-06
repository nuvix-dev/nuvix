import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class HeadersModel extends BaseModel {
  /**
   * Header name.
   */
  @Expose() name = ''

  /**
   * Header value.
   */
  @Expose() value = ''

  constructor(partial: Partial<HeadersModel>) {
    super()
    Object.assign(this, partial)
  }
}
