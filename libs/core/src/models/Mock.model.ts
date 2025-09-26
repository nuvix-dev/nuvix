import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from '@nuvix/core/models/base.model';

@Exclude()
export class MockModel extends BaseModel {
  /**
   * Result message.
   */
  @Expose() result: string = ''; // Default to empty string

  constructor(partial: Partial<MockModel>) {
    super();
    Object.assign(this, partial);
  }
}
