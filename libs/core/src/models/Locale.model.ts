import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class LocaleModel extends BaseModel {
  /**
   * User IP address.
   */
  @Expose() ip = ''

  /**
   * Country code in ISO 3166-1 two-character format.
   */
  @Expose() countryCode = ''

  /**
   * Country name. This field supports localization.
   */
  @Expose() country = ''

  /**
   * Continent code. A two character continent code.
   */
  @Expose() continentCode = ''

  /**
   * Continent name. This field supports localization.
   */
  @Expose() continent = ''

  /**
   * True if country is part of the European Union.
   */
  @Expose() eu = false

  /**
   * Currency code in ISO 4217 three-character format.
   */
  @Expose() currency = ''

  constructor(partial: Partial<LocaleModel>) {
    super()
    Object.assign(this, partial)
  }
}
