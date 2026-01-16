import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class SessionModel extends BaseModel {
  /**
   * User ID.
   */
  @Expose() userId: string = '' // Default to empty string

  /**
   * Session expiration date in ISO 8601 format.
   */
  @Expose() expire: string = '' // Default to empty string

  /**
   * Session Provider.
   */
  @Expose() provider: string = '' // Default to empty string

  /**
   * Session Provider User ID.
   */
  @Expose() providerUid: string = '' // Default to empty string

  /**
   * Session Provider Access Token.
   */
  @Expose() providerAccessToken: string = '' // Default to empty string

  /**
   * The date of when the access token expires in ISO 8601 format.
   */
  @Expose() providerAccessTokenExpiry: string = '' // Default to empty string

  /**
   * Session Provider Refresh Token.
   */
  @Expose() providerRefreshToken: string = '' // Default to empty string

  /**
   * IP in use when the session was created.
   */
  @Expose() ip: string = '' // Default to empty string

  /**
   * Operating system code name.
   */
  @Expose() osCode: string = '' // Default to empty string

  /**
   * Operating system name.
   */
  @Expose() osName: string = '' // Default to empty string

  /**
   * Operating system version.
   */
  @Expose() osVersion: string = '' // Default to empty string

  /**
   * Client type.
   */
  @Expose() clientType: string = '' // Default to empty string

  /**
   * Client code name.
   */
  @Expose() clientCode: string = '' // Default to empty string

  /**
   * Client name.
   */
  @Expose() clientName: string = '' // Default to empty string

  /**
   * Client version.
   */
  @Expose() clientVersion: string = '' // Default to empty string

  /**
   * Client engine name.
   */
  @Expose() clientEngine: string = '' // Default to empty string

  /**
   * Client engine version.
   */
  @Expose() clientEngineVersion: string = '' // Default to empty string

  /**
   * Device name.
   */
  @Expose() deviceName: string = '' // Default to empty string

  /**
   * Device brand name.
   */
  @Expose() deviceBrand: string = '' // Default to empty string

  /**
   * Device model name.
   */
  @Expose() deviceModel: string = '' // Default to empty string

  /**
   * Country two-character ISO 3166-1 alpha code.
   */
  @Expose() countryCode: string = '' // Default to empty string

  /**
   * Country name.
   */
  @Expose() countryName: string = '' // Default to empty string

  /**
   * Returns true if this is the current user session.
   */
  @Expose() current: boolean = false // Default to false

  /**
   * Returns a list of active session factors.
   */
  @Expose() factors: string[] = [] // Default to empty array

  /**
   * Secret used to authenticate the user.
   */
  @Expose() secret: string = '' // Default to empty string

  /**
   * Most recent date when the session successfully passed MFA challenge.
   */
  @Expose() mfaUpdatedAt: string = '' // Default to empty string

  constructor(partial: Partial<SessionModel>) {
    super()
    Object.assign(this, partial)
  }
}
