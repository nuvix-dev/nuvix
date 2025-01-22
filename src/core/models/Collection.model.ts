import { Exclude, Expose } from 'class-transformer';
import BaseModel from 'src/core/models/base.model';

@Exclude()
export class CollectionModel extends BaseModel {
  /**
   * Database ID.
   */
  @Expose() databaseId: string = '';

  /**
   * Collection name.
   */
  @Expose() name: string = '';

  /**
   * Collection enabled. Can be 'enabled' or 'disabled'.
   * When disabled, the collection is inaccessible to users,
   * but remains accessible to Server SDKs using API keys.
   */
  @Expose() enabled: boolean;

  /**
   * Whether document-level permissions are enabled.
   */
  @Expose() documentSecurity: boolean;

  /**
   * Collection attributes.
   */
  @Expose() attributes: Array<string> = [];

  /**
   * Collection indexes.
   */
  @Expose() indexes: Array<string> = [];

  constructor(partial: Partial<CollectionModel>) {
    super();
    Object.assign(this, partial);
  }
}
