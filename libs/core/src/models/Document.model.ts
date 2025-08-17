import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

/**
 * Doc model.
 */
export class DocumentModel extends BaseModel {
  /**
   * Collection ID.
   */
  @Expose() collectionId: string = '';

  /**
   * Database ID.
   */
  @Expose() databaseId: string = '';

  /**
   * Runtime.
   */
  @Expose() runtime: string = '';

  @Exclude() $internalId: any;
  @Exclude() $tenant: any;
  @Exclude() declare $collection: any;
}
