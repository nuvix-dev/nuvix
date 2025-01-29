import { Exclude, Expose, Type } from 'class-transformer';
import BaseModel from 'src/core/models/base.model';
import { AttributeModel } from './Attribute.model';
import { IndexModel } from './Index.model';

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
  @Expose()
  @Type(() => AttributeModel)
  attributes: AttributeModel[] = [];

  /**
   * Collection indexes.
   */
  @Expose()
  @Type(() => IndexModel)
  indexes: IndexModel[] = [];

  constructor(partial: Partial<CollectionModel>) {
    super();
    Object.assign(this, partial);
  }
}
