import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class LogModel extends BaseModel {
  /**
   * Event name.
   */
  @Expose() event: string = ''

  /**
   * User ID.
   */
  @Expose() userId: string = ''

  /**
   * User Email.
   */
  @Expose() userEmail: string = ''

  /**
   * User Name.
   */
  @Expose() userName: string = ''

  /**
   * API mode when event triggered.
   */
  @Expose() mode: string = ''

  /**
   * IP session in use when the session was created.
   */
  @Expose() ip: string = ''

  /**
   * Log creation date in ISO 8601 format.
   */
  @Expose() declare time: string // No default value

  /**
   * Operating system code name.
   */
  @Expose() osCode: string = ''

  /**
   * Operating system name.
   */
  @Expose() osName: string = ''

  /**
   * Operating system version.
   */
  @Expose() osVersion: string = ''

  /**
   * Client type.
   */
  @Expose() clientType: string = ''

  /**
   * Client code name.
   */
  @Expose() clientCode: string = ''

  /**
   * Client name.
   */
  @Expose() clientName: string = ''

  /**
   * Client version.
   */
  @Expose() clientVersion: string = ''

  /**
   * Client engine name.
   */
  @Expose() clientEngine: string = ''

  /**
   * Client engine version.
   */
  @Expose() clientEngineVersion: string = ''

  /**
   * Device name.
   */
  @Expose() deviceName: string = ''

  /**
   * Device brand name.
   */
  @Expose() deviceBrand: string = ''

  /**
   * Device model name.
   */
  @Expose() deviceModel: string = ''

  /**
   * Country two-character ISO 3166-1 alpha code.
   */
  @Expose() countryCode: string = ''

  /**
   * Country name.
   */
  @Expose() countryName: string = ''

  constructor(partial: Partial<LogModel>) {
    super()
    Object.assign(this, partial)
  }
}
