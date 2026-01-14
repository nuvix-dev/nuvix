import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class MFAFactorsModel extends BaseModel {
  /**
   * Can TOTP be used for MFA challenge for this account.
   */
  @Expose() totp: boolean = false

  /**
   * Can phone (SMS) be used for MFA challenge for this account.
   */
  @Expose() phone: boolean = false

  /**
   * Can email be used for MFA challenge for this account.
   */
  @Expose() email: boolean = false

  /**
   * Can recovery code be used for MFA challenge for this account.
   */
  @Expose() recoveryCode: boolean = false

  constructor(partial: Partial<MFAFactorsModel>) {
    super()
    Object.assign(this, partial)
  }
}
