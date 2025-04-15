import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

/**
 * Document model.
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
   * Document ID.
   */
  @Expose() id: string = '';

  /**
   * Document creation date in ISO 8601 format.
   */
  @Expose() createdAt: string = '';

  /**
   * Document update date in ISO 8601 format.
   */
  @Expose() updatedAt: string = '';

  /**
   * Document permissions.
   */
  @Expose() permissions: string[] = [];

  /**
   * Runtime.
   */
  @Expose() runtime: string = '';

  @Exclude() $internalId: any;
  @Exclude() $tenant: any;
  @Exclude() $collection: any;
}
