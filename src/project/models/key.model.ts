import { Exclude, Expose } from "class-transformer";
import BaseModel from "src/core/models/base.model";


@Exclude()
export class KeyModel extends BaseModel {
  /**
   * Key name.
   */
  @Expose() name: string;
  /**
   * Key expiration date in ISO 8601 format.
   */
  @Expose() expire: string;
  /**
   * Allowed permission scopes.
   */
  @Expose() scopes: string[];
  /**
   * Secret key.
   */
  @Expose() secret: string;
  /**
   * Most recent access date in ISO 8601 format. This attribute is only updated again after 24 hours.
   */
  @Expose() accessedAt: string;
  /**
   * List of SDK user agents that used this key.
   */
  @Expose() sdks: string[];

}