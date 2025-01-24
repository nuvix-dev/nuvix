import { Permission } from '@nuvix/database';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export default abstract class BaseModel {
  /**
   *  ID.
   */
  @Expose() $id: string;
  /**
   * User creation date in ISO 8601 format.
   */
  @Expose() $createdAt: Date;
  /**
   * User update date in ISO 8601 format.
   */
  @Expose() $updatedAt: Date;

  @Expose() $permissions: string[] | Permission[];

  @Exclude() _id: any;
  @Exclude() id: string;

  constructor(doc?: any) {
    Object.assign(this, doc);
  }
}

@Exclude()
export abstract class BaseListModel {
  @Expose() total: number;

  constructor() {}
}
