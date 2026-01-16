import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class MetricModel extends BaseModel {
  /**
   * The value of this metric at the timestamp.
   */
  @Expose() value: number = -1 // Default to -1

  /**
   * The date at which this metric was aggregated in ISO 8601 format.
   */
  @Expose() declare date: string // No default value

  constructor(partial: Partial<MetricModel>) {
    super()
    Object.assign(this, partial)
  }
}
