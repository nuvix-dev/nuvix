import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class VariableModel extends BaseModel {
  /**
   * Variable key.
   */
  @Expose() key = '' // Default to empty string

  /**
   * Variable value.
   */
  @Expose() value = '' // Default to empty string

  /**
   * Service to which the variable belongs. Possible values are "project", "function".
   */
  @Expose() resourceType = '' // Default to empty string

  /**
   * ID of resource to which the variable belongs. If resourceType is "project", it is empty. If resourceType is "function", it is ID of the function.
   */
  @Expose() resourceId = '' // Default to empty string

  constructor(partial: Partial<VariableModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}
