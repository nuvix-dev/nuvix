import { Exclude, Expose, Transform, Type } from 'class-transformer';
import BaseModel from 'src/core/models/base.model';
import { IndexModel } from './Index.model';
import { Database } from '@nuvix/database';
import {
  AttributeBooleanModel,
  AttributeDatetimeModel,
  AttributeEmailModel,
  AttributeEnumModel,
  AttributeFloatModel,
  AttributeIntegerModel,
  AttributeIPModel,
  AttributeRelationshipModel,
  AttributeStringModel,
  AttributeURLModel,
} from './Attributes.model';
import {
  APP_DATABASE_ATTRIBUTE_EMAIL,
  APP_DATABASE_ATTRIBUTE_ENUM,
  APP_DATABASE_ATTRIBUTE_IP,
  APP_DATABASE_ATTRIBUTE_URL,
} from 'src/Utils/constants';

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
  @Transform(({ obj }) => {
    console.log(obj);
    return (obj?.attributes ?? ([] as any[])).map((att: any) => {
      switch (att.type) {
        case Database.VAR_BOOLEAN:
          return new AttributeBooleanModel(att);
        case Database.VAR_INTEGER:
          return new AttributeIntegerModel(att);
        case Database.VAR_FLOAT:
          return new AttributeFloatModel(att);
        case Database.VAR_DATETIME:
          return new AttributeDatetimeModel(att);
        case Database.VAR_RELATIONSHIP:
          return new AttributeRelationshipModel(att);
        case Database.VAR_STRING:
          switch (att.format) {
            case APP_DATABASE_ATTRIBUTE_EMAIL:
              return new AttributeEmailModel(att);
            case APP_DATABASE_ATTRIBUTE_ENUM:
              return new AttributeEnumModel(att);
            case APP_DATABASE_ATTRIBUTE_IP:
              return new AttributeIPModel(att);
            case APP_DATABASE_ATTRIBUTE_URL:
              return new AttributeURLModel(att);
            default:
              return new AttributeStringModel(att);
          }
        default:
          return new AttributeStringModel(att);
      }
    });
  })
  attributes: any[] = [];

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
