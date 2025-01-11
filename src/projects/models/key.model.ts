import { Exclude, Expose } from "class-transformer";
import BaseModel, { BaseListModel } from "src/core/models/base.model";


@Exclude()
export class KeyModel extends BaseModel {
  /**
   * Key name.
   */
  @Expose() name: string;
  /**
   * Key expiration date in ISO 8601 format.
   */
  @Expose() expire: Date;
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
  @Expose() accessedAt: Date
  /**
   * List of SDK user agents that used this key.
   */
  @Expose() sdks: string[];

  constructor(data: Partial<KeyModel> = {}) {
    super(data);
  }

}


export class KeyListModel extends BaseListModel {
  /**
   * List of keys.
   */
  keys: KeyModel[];

  constructor(data: Partial<KeyListModel | any> = {}) {
    super();
    this.keys = data.keys ? data.keys.map((key: any) => new KeyModel(key)) : [];
    this.total = data.total || 0;
  }

}