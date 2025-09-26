import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from './base.model';

@Exclude()
export class KeyModel extends BaseModel {
  /**
   * Key name.
   */
  @Expose() declare name: string;
  /**
   * Key expiration date in ISO 8601 format.
   */
  @Expose() declare expire: string;
  /**
   * Allowed permission scopes.
   */
  @Expose() declare scopes: string[];
  /**
   * Secret key.
   */
  @Expose() declare secret: string;
  /**
   * Most recent access date in ISO 8601 format. This attribute is only updated again after 24 hours.
   */
  @Expose() declare accessedAt: string;
  /**
   * List of SDK user agents that used this key.
   */
  @Expose() declare sdks: string[];
}
