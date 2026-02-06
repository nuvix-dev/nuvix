import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class SessionModel extends BaseModel {
  /**
   * User ID.
   */
  @Expose() userId = '' // Default to empty string

  /**
   * Session expiration date in ISO 8601 format.
   */
  @Expose() expire = '' // Default to empty string

  /**
   * Session Provider.
   */
  @Expose() provider = '' // Default to empty string

  /**
   * Session Provider User ID.
   */
  @Expose() providerUid = '' // Default to empty string

  /**
   * Session Provider Access Token.
   */
  @Expose() providerAccessToken = '' // Default to empty string

  /**
   * The date of when the access token expires in ISO 8601 format.
   */
  @Expose() providerAccessTokenExpiry = '' // Default to empty string

  /**
   * Session Provider Refresh Token.
   */
  @Expose() providerRefreshToken = '' // Default to empty string

  /**
   * IP in use when the session was created.
   */
  @Expose() ip = '' // Default to empty string

  /**
   * Operating system code name.
   */
  @Expose() osCode = '' // Default to empty string

  /**
   * Operating system name.
   */
  @Expose() osName = '' // Default to empty string

  /**
   * Operating system version.
   */
  @Expose() osVersion = '' // Default to empty string

  /**
   * Client type.
   */
  @Expose() clientType = '' // Default to empty string

  /**
   * Client code name.
   */
  @Expose() clientCode = '' // Default to empty string

  /**
   * Client name.
   */
  @Expose() clientName = '' // Default to empty string

  /**
   * Client version.
   */
  @Expose() clientVersion = '' // Default to empty string

  /**
   * Client engine name.
   */
  @Expose() clientEngine = '' // Default to empty string

  /**
   * Client engine version.
   */
  @Expose() clientEngineVersion = '' // Default to empty string

  /**
   * Device name.
   */
  @Expose() deviceName = '' // Default to empty string

  /**
   * Device brand name.
   */
  @Expose() deviceBrand = '' // Default to empty string

  /**
   * Device model name.
   */
  @Expose() deviceModel = '' // Default to empty string

  /**
   * Country two-character ISO 3166-1 alpha code.
   */
  @Expose() countryCode = '' // Default to empty string

  /**
   * Country name.
   */
  @Expose() countryName = '' // Default to empty string

  /**
   * Returns true if this is the current user session.
   */
  @Expose() current = false // Default to false

  /**
   * Returns a list of active session factors.
   */
  @Expose() factors: string[] = [] // Default to empty array

  /**
   * Secret used to authenticate the user.
   */
  @Expose() secret = '' // Default to empty string

  /**
   * Most recent date when the session successfully passed MFA challenge.
   */
  @Expose() mfaUpdatedAt = '' // Default to empty string

  constructor(partial: Partial<SessionModel>) {
    super()
    Object.assign(this, partial)
  }
}
