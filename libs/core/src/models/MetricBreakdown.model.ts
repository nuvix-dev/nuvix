import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from '@nuvix/core/models/base.model';

@Exclude()
export class MetricBreakdownModel extends BaseModel {
  /**
   * Resource ID.
   */
  @Expose() resourceId: string = '';

  /**
   * Resource name.
   */
  @Expose() name: string = '';

  /**
   * The value of this metric at the timestamp.
   */
  @Expose() value: number = 0; // Default to 0

  constructor(partial: Partial<MetricBreakdownModel>) {
    super();
    Object.assign(this, partial);
  }
}
