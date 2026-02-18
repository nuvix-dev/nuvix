import { Exclude, Expose, Transform } from 'class-transformer'
import { BaseModel } from './base.model'
import { Auth } from '../helpers'

@Exclude()
export class AuthProviderModel extends BaseModel {
  /**
   * Auth Provider key.
   */
  @Expose() key = ''

  /**
   * Auth Provider name.
   */
  @Expose() name = ''

  /**
   * OAuth 2.0 application ID.
   */
  @Expose() appId = ''

  /**
   * OAuth 2.0 application secret. Might be JSON string if provider requires extra configuration.
   */
  @Transform(({ value }) => Auth.decryptIfDefined(value)) // Decrypt the secret when transforming to class instance
  @Expose()
  declare secret: string

  /**
   * Auth Provider is active and can be used to create session.
   */
  @Expose() enabled = false

  constructor(partial: Partial<AuthProviderModel>) {
    super()
    Object.assign(this, partial)
  }

  /**
   * Get Name
   *
   * @return string
   */
  getName(): string {
    return 'AuthProvider'
  }

  /**
   * Get Type
   *
   * @return string
   */
  getType(): string {
    return 'MODEL_AUTH_PROVIDER'
  }
}
