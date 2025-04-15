import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class LocaleCodeModel extends BaseModel {
  /**
   * Locale codes in ISO 639-1.
   */
  @Expose() code: string = '';

  /**
   * Locale name.
   */
  @Expose() name: string = '';

  constructor(partial: Partial<LocaleCodeModel>) {
    super();
    Object.assign(this, partial);
  }
}
