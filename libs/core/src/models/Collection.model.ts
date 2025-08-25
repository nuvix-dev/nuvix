import { Exclude, Expose, Transform, Type } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';
import { IndexModel } from './Index.model';
import { AttributeType } from '@nuvix-tech/db';
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
import { AttributeFormat } from '@nuvix/utils';

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
  @Expose() declare enabled: boolean;

  /**
   * Whether document-level permissions are enabled.
   */
  @Expose() declare documentSecurity: boolean;

  /**
   * Collection attributes.
   */
  @Expose()
  @Transform(({ obj }) => {
    return (obj?.attributes ?? ([] as any[])).map((att: any) => {
      switch (att.type) {
        case AttributeType.Boolean:
          return new AttributeBooleanModel(att);
        case AttributeType.Integer:
          return new AttributeIntegerModel(att);
        case AttributeType.Float:
          return new AttributeFloatModel(att);
        case AttributeType.Timestamptz:
          return new AttributeDatetimeModel(att);
        case AttributeType.Relationship:
          return new AttributeRelationshipModel(att);
        case AttributeType.String:
          switch (att.format) {
            case AttributeFormat.EMAIL:
              return new AttributeEmailModel(att);
            case AttributeFormat.ENUM:
              return new AttributeEnumModel(att);
            case AttributeFormat.IP:
              return new AttributeIPModel(att);
            case AttributeFormat.URL:
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
