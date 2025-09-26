import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from '@nuvix/core/models/base.model';

@Exclude()
export class CountryModel extends BaseModel {
  /**
   * Country name.
   */
  @Expose() name: string = '';

  /**
   * Country two-character ISO 3166-1 alpha code.
   */
  @Expose() code: string = '';

  constructor(partial: Partial<CountryModel>) {
    super();
    Object.assign(this, partial);
  }
}
