import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from '@nuvix/core/models/base.model';

@Exclude()
export class SpecificationModel extends BaseModel {
  /**
   * Memory size in MB.
   */
  @Expose() memory: number = 0; // Default to 0

  /**
   * Number of CPUs.
   */
  @Expose() cpus: number = 0; // Default to 0

  /**
   * Is size enabled.
   */
  @Expose() enabled: boolean = false; // Default to false

  /**
   * Size slug.
   */
  @Expose() slug: string = ''; // Default to empty string

  constructor(partial: Partial<SpecificationModel>) {
    super();
    Object.assign(this, partial);
  }
}
