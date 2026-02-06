import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class CurrencyModel extends BaseModel {
  /**
   * Currency symbol.
   */
  @Expose() symbol = ''

  /**
   * Currency name.
   */
  @Expose() name = ''

  /**
   * Currency native symbol.
   */
  @Expose() symbolNative = ''

  /**
   * Number of decimal digits.
   */
  @Expose() decimalDigits = 0

  /**
   * Currency digit rounding.
   */
  @Expose() rounding = 0

  /**
   * Currency code in ISO 4217 three-character format.
   */
  @Expose() code = ''

  /**
   * Currency plural name.
   */
  @Expose() namePlural = ''

  constructor(partial: Partial<CurrencyModel>) {
    super()
    Object.assign(this, partial)
  }
}
