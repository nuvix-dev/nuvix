import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class CurrencyModel extends BaseModel {
  /**
   * Currency symbol.
   */
  @Expose() symbol: string = ''

  /**
   * Currency name.
   */
  @Expose() name: string = ''

  /**
   * Currency native symbol.
   */
  @Expose() symbolNative: string = ''

  /**
   * Number of decimal digits.
   */
  @Expose() decimalDigits: number = 0

  /**
   * Currency digit rounding.
   */
  @Expose() rounding: number = 0

  /**
   * Currency code in ISO 4217 three-character format.
   */
  @Expose() code: string = ''

  /**
   * Currency plural name.
   */
  @Expose() namePlural: string = ''

  constructor(partial: Partial<CurrencyModel>) {
    super()
    Object.assign(this, partial)
  }
}
