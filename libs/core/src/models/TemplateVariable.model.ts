import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class TemplateVariableModel extends BaseModel {
  /**
   * Variable Name.
   */
  @Expose() name = '' // Default to empty string

  /**
   * Variable Description.
   */
  @Expose() description = '' // Default to empty string

  /**
   * Variable Value.
   */
  @Expose() value = '' // Default to empty string

  /**
   * Variable Placeholder.
   */
  @Expose() placeholder = '' // Default to empty string

  /**
   * Is the variable required?
   */
  @Expose() required = false // Default to false

  /**
   * Variable Type.
   */
  @Expose() type = '' // Default to empty string

  constructor(partial: Partial<TemplateVariableModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}
