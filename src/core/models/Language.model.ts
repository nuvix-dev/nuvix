import { Exclude, Expose } from 'class-transformer';
import BaseModel from 'src/core/models/base.model';

@Exclude()
export class LanguageModel extends BaseModel {
  /**
   * Language name.
   */
  @Expose() name: string = '';

  /**
   * Language two-character ISO 639-1 codes.
   */
  @Expose() code: string = '';

  /**
   * Language native name.
   */
  @Expose() nativeName: string = '';

  constructor(partial: Partial<LanguageModel>) {
    super();
    Object.assign(this, partial);
  }
}
