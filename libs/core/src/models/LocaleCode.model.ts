import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class LocaleCodeModel extends BaseModel {
  /**
   * Locale codes in ISO 639-1.
   */
  @Expose() code = ''

  /**
   * Locale name.
   */
  @Expose() name = ''

  constructor(partial: Partial<LocaleCodeModel>) {
    super()
    Object.assign(this, partial)
  }
}
