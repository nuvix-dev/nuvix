import { Exclude, Expose } from "class-transformer";
import BaseModel from "src/core/models/base.model";


@Exclude()
export class PlatformModel extends BaseModel {
  /**
      * Platform name.
      */
  @Expose() name: string;
  /**
   * Platform type. Possible values are: web, flutter-web, flutter-ios, flutter-android, ios, android, and unity.
   */
  @Expose() type: string;
  /**
   * Platform Key. iOS bundle ID or Android package name.  Empty string for other platforms.
   */
  @Expose() key: string;
  /**
   * App store or Google Play store ID.
   */
  @Expose() store: string;
  /**
   * Web app hostname. Empty string for other platforms.
   */
  @Expose() hostname: string;
  /**
   * HTTP basic authentication username.
   */
  @Expose() httpUser: string;
  /**
   * HTTP basic authentication password.
   */
  @Expose() httpPass: string;
}