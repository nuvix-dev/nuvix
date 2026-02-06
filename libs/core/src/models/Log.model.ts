import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class LogModel extends BaseModel {
  /**
   * Event name.
   */
  @Expose() event = ''

  /**
   * User ID.
   */
  @Expose() userId = ''

  /**
   * User Email.
   */
  @Expose() userEmail = ''

  /**
   * User Name.
   */
  @Expose() userName = ''

  /**
   * API mode when event triggered.
   */
  @Expose() mode = ''

  /**
   * IP session in use when the session was created.
   */
  @Expose() ip = ''

  /**
   * Log creation date in ISO 8601 format.
   */
  @Expose() declare time: string // No default value

  /**
   * Operating system code name.
   */
  @Expose() osCode = ''

  /**
   * Operating system name.
   */
  @Expose() osName = ''

  /**
   * Operating system version.
   */
  @Expose() osVersion = ''

  /**
   * Client type.
   */
  @Expose() clientType = ''

  /**
   * Client code name.
   */
  @Expose() clientCode = ''

  /**
   * Client name.
   */
  @Expose() clientName = ''

  /**
   * Client version.
   */
  @Expose() clientVersion = ''

  /**
   * Client engine name.
   */
  @Expose() clientEngine = ''

  /**
   * Client engine version.
   */
  @Expose() clientEngineVersion = ''

  /**
   * Device name.
   */
  @Expose() deviceName = ''

  /**
   * Device brand name.
   */
  @Expose() deviceBrand = ''

  /**
   * Device model name.
   */
  @Expose() deviceModel = ''

  /**
   * Country two-character ISO 3166-1 alpha code.
   */
  @Expose() countryCode = ''

  /**
   * Country name.
   */
  @Expose() countryName = ''

  constructor(partial: Partial<LogModel>) {
    super()
    Object.assign(this, partial)
  }
}
