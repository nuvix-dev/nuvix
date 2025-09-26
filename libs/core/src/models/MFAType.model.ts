import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from '@nuvix/core/models/base.model';

@Exclude()
export class MFATypeModel extends BaseModel {
  /**
   * Secret token used for TOTP factor.
   */
  @Expose() secret: string = '';

  /**
   * URI for authenticator apps.
   */
  @Expose() uri: string = '';

  constructor(partial: Partial<MFATypeModel>) {
    super();
    Object.assign(this, partial);
  }
}
