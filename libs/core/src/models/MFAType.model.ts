import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class MFATypeModel extends BaseModel {
  /**
   * Secret token used for TOTP factor.
   */
  @Expose() secret = ''

  /**
   * URI for authenticator apps.
   */
  @Expose() uri = ''

  constructor(partial: Partial<MFATypeModel>) {
    super()
    Object.assign(this, partial)
  }
}
