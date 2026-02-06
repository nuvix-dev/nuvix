import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class MetricBreakdownModel extends BaseModel {
  /**
   * Resource ID.
   */
  @Expose() resourceId = ''

  /**
   * Resource name.
   */
  @Expose() name = ''

  /**
   * The value of this metric at the timestamp.
   */
  @Expose() value = 0 // Default to 0

  constructor(partial: Partial<MetricBreakdownModel>) {
    super()
    Object.assign(this, partial)
  }
}
