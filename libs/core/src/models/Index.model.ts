import { Permission } from '@nuvix/database';
import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class IndexModel extends BaseModel {
  @Exclude()
  override $id: string;
  @Exclude() $permissions: string[] | Permission[];
  /**
   * Index Key.
   */
  @Expose() key: string = '';

  /**
   * Index type.
   */
  @Expose() type: string = '';

  /**
   * Index status. Possible values: `available`, `processing`, `deleting`, `stuck`, or `failed`.
   */
  @Expose() status: string = '';

  /**
   * Error message. Displays error generated on failure of creating or deleting an index.
   */
  @Expose() error: string = '';

  /**
   * Index attributes.
   */
  @Expose() attributes: string[] = [];

  /**
   * Index orders.
   */
  @Expose() orders: string[] = []; // Optional, default to empty array

  constructor(partial: Partial<IndexModel>) {
    super();
    Object.assign(this, partial);
  }
}
