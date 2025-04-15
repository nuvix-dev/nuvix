import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class MFARecoveryCodesModel extends BaseModel {
  /**
   * Recovery codes.
   */
  @Expose() recoveryCodes: string[] = [];

  constructor(partial: Partial<MFARecoveryCodesModel>) {
    super();
    Object.assign(this, partial);
  }
}
