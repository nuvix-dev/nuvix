import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class HeadersModel extends BaseModel {
  /**
   * Header name.
   */
  @Expose() name: string = '';

  /**
   * Header value.
   */
  @Expose() value: string = '';

  constructor(partial: Partial<HeadersModel>) {
    super();
    Object.assign(this, partial);
  }
}
