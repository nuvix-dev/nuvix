import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class MFAChallengeModel extends BaseModel {
  /**
   * Token ID.
   */
  @Expose() id: string = '';

  /**
   * Token creation date in ISO 8601 format.
   */
  @Expose() createdAt: string; // No default value

  /**
   * User ID.
   */
  @Expose() userId: string = '';

  /**
   * Token expiration date in ISO 8601 format.
   */
  @Expose() expire: string; // No default value

  constructor(partial: Partial<MFAChallengeModel>) {
    super();
    Object.assign(this, partial);
  }
}
