import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class MFAFactorsModel extends BaseModel {
  /**
   * Can TOTP be used for MFA challenge for this account.
   */
  @Expose() totp = false

  /**
   * Can phone (SMS) be used for MFA challenge for this account.
   */
  @Expose() phone = false

  /**
   * Can email be used for MFA challenge for this account.
   */
  @Expose() email = false

  /**
   * Can recovery code be used for MFA challenge for this account.
   */
  @Expose() recoveryCode = false

  constructor(partial: Partial<MFAFactorsModel>) {
    super()
    Object.assign(this, partial)
  }
}
