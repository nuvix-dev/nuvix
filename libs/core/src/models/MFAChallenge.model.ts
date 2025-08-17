import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class MFAChallengeModel extends BaseModel {
  /**
   * User ID.
   */
  @Expose() userId: string = '';

  /**
   * Token expiration date in ISO 8601 format.
   */
  @Expose() declare expire: string; // No default value

  constructor(partial: Partial<MFAChallengeModel>) {
    super();
    Object.assign(this, partial);
  }
}
