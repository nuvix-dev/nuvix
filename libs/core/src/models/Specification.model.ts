import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class SpecificationModel extends BaseModel {
  /**
   * Memory size in MB.
   */
  @Expose() memory = 0 // Default to 0

  /**
   * Number of CPUs.
   */
  @Expose() cpus = 0 // Default to 0

  /**
   * Is size enabled.
   */
  @Expose() enabled = false // Default to false

  /**
   * Size slug.
   */
  @Expose() slug = '' // Default to empty string

  constructor(partial: Partial<SpecificationModel>) {
    super()
    Object.assign(this, partial)
  }
}
