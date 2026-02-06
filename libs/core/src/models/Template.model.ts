import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export abstract class TemplateModel extends BaseModel {
  /**
   * Template type.
   */
  @Expose() type = '' // Default to empty string

  /**
   * Template locale.
   */
  @Expose() locale = '' // Default to empty string

  /**
   * Template message.
   */
  @Expose() message = '' // Default to empty string

  constructor(partial: Partial<TemplateModel>) {
    super()
    Object.assign(this, partial)
  }
}
