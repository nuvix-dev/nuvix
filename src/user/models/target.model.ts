import { Exclude, Expose } from "class-transformer";
import BaseModel from "src/core/models/base.model";

@Exclude()
export class Target extends BaseModel {
  /**
   * Target Name.
   */
  @Expose() name: string;
  /**
   * User ID.
   */
  @Expose() userId: string;
  /**
   * Provider ID.
   */
  @Expose() providerId?: string;
  /**
   * The target provider type. Can be one of the following: `email`, `sms` or `push`.
   */
  @Expose() providerType: string;
  /**
   * The target identifier.
   */
  @Expose() identifier: string;
  /**
   * Is the target expired.
   */
  // @Expose() expired: boolean;
}