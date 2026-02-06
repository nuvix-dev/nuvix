import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class PlatformModel extends BaseModel {
  /**
   * Platform name.
   */
  @Expose() name = '' // Default to empty string

  /**
   * Platform type. Possible values are: web, flutter-web, flutter-ios, flutter-android, ios, android, and unity.
   */
  @Expose() type = '' // Default to empty string

  /**
   * Platform Key. iOS bundle ID or Android package name. Empty string for other platforms.
   */
  @Expose() key = '' // Default to empty string

  /**
   * App store or Google Play store ID.
   */
  @Expose() store = '' // Default to empty string

  /**
   * Web app hostname. Empty string for other platforms.
   */
  @Expose() hostname = '' // Default to empty string

  /**
   * HTTP basic authentication username.
   */
  @Expose() httpUser = '' // Default to empty string

  /**
   * HTTP basic authentication password.
   */
  @Expose() httpPass = '' // Default to empty string

  /**
   * Indicates if the platform is public.
   */
  public = false // Default to false

  constructor(partial: Partial<PlatformModel>) {
    super()
    Object.assign(this, partial)
  }
}
