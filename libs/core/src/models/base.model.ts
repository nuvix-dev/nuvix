import { Permission } from '@nuvix-tech/db';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export default abstract class BaseModel {
  /**
   *  ID.
   */
  @Expose() declare $id: string;
  /**
   * User creation date in ISO 8601 format.
   */
  @Expose() declare $createdAt: Date;
  /**
   * User update date in ISO 8601 format.
   */
  @Expose() declare $updatedAt: Date;

  @Expose() declare $permissions: string[] | Permission[];

  @Exclude() _id: any;
  @Exclude() declare id: string;
  @Exclude() $collection: any;

  constructor(doc?: any) {
    Object.assign(this, doc);
  }
}

@Exclude()
export abstract class BaseListModel {
  @Expose() declare total: number;

  constructor() {}
}
