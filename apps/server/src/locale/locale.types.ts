import { LocaleTranslator } from '@nuvix/core/helpers'

export declare namespace TLocalService {
  type GetUserLocale = {
    ip: string
    locale: LocaleTranslator
  }
}

export declare namespace ILocaleResponse {
  interface GetUserLocale {
    ip: string
    countryCode: string
    country: string
    continent: string
    continentCode: string
    eu: boolean
    currency: null | string
  }

  interface GetLocaleCodes {
    code: string
    name: string
  }

  interface GetCountries {
    code: string
    name: string
  }

  interface GetCountriesPhone {
    code: string
    countryCode: string
    countryName: string
  }

  interface GetContinents {
    name: string
    code: string
  }

  interface GetCurrencies {
    symbol: string
    name: string
    symbolNative: string
    decimalDigits: number
    rounding: number
    code: string
    namePlural: string
    locations: string[]
  }

  interface GetLanguages {
    code: string
    name: string
    nativeName: string
  }
}
