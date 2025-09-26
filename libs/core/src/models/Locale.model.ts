import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from '@nuvix/core/models/base.model';

@Exclude()
export class LocaleModel extends BaseModel {
  /**
   * User IP address.
   */
  @Expose() ip: string = '';

  /**
   * Country code in ISO 3166-1 two-character format.
   */
  @Expose() countryCode: string = '';

  /**
   * Country name. This field supports localization.
   */
  @Expose() country: string = '';

  /**
   * Continent code. A two character continent code.
   */
  @Expose() continentCode: string = '';

  /**
   * Continent name. This field supports localization.
   */
  @Expose() continent: string = '';

  /**
   * True if country is part of the European Union.
   */
  @Expose() eu: boolean = false;

  /**
   * Currency code in ISO 4217 three-character format.
   */
  @Expose() currency: string = '';

  constructor(partial: Partial<LocaleModel>) {
    super();
    Object.assign(this, partial);
  }
}
