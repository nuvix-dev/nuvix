import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class PhoneModel extends BaseModel {
  /**
   * Phone code.
   */
  @Expose() code = '' // Default to empty string

  /**
   * Country two-character ISO 3166-1 alpha code.
   */
  @Expose() countryCode = '' // Default to empty string

  /**
   * Country name.
   */
  @Expose() countryName = '' // Default to empty string

  constructor(partial: Partial<PhoneModel>) {
    super()
    Object.assign(this, partial)
  }
}
