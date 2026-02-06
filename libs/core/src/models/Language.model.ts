import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class LanguageModel extends BaseModel {
  /**
   * Language name.
   */
  @Expose() name = ''

  /**
   * Language two-character ISO 639-1 codes.
   */
  @Expose() code = ''

  /**
   * Language native name.
   */
  @Expose() nativeName = ''

  constructor(partial: Partial<LanguageModel>) {
    super()
    Object.assign(this, partial)
  }
}
