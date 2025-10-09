import { Controller, Ip, UseGuards, UseInterceptors } from '@nestjs/common'
import { ProjectGuard } from '@nuvix/core/resolvers/guards'
import {
  ResponseInterceptor,
  ApiInterceptor,
} from '@nuvix/core/resolvers/interceptors'
import { Auth, AuthType, Locale, Namespace } from '@nuvix/core/decorators'
import { Get } from '@nuvix/core'
import { LocaleService } from './locale.service'
import { LocaleTranslator, Models } from '@nuvix/core/helper'
import type { IListResponse, IResponse } from '@nuvix/utils'
import type { ILocaleResponse } from './locale.types'
import {
  continents,
  countries,
  currencies,
  euList,
  languages,
  localeCodes,
  phoneCodes,
} from '@nuvix/core/config'

@Controller({ version: ['1'], path: 'locale' })
@UseGuards(ProjectGuard)
@Namespace('locale')
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.SESSION, AuthType.JWT, AuthType.KEY])
export class LocaleController {
  constructor(private readonly localeService: LocaleService) {}

  @Get('', {
    summary: 'Get user locale',
    scopes: 'locale.read',
    model: Models.LOCALE,
    sdk: {
      name: 'get',
      descMd: '/docs/references/locale/get-locale.md',
    },
  })
  getUserLocale(
    @Ip() ip: string,
    @Locale() locale: LocaleTranslator,
  ): IResponse<ILocaleResponse.GetUserLocale> {
    return this.localeService.getUserLocale({
      ip,
      locale,
    })
  }

  @Get('codes', {
    summary: 'List locale codes',
    scopes: 'locale.read',
    model: { type: Models.LOCALE_CODE, list: true },
    sdk: {
      name: 'listCodes',
      descMd: '/docs/references/locale/list-locale-codes.md',
    },
  })
  getLocaleCodes(): IListResponse<ILocaleResponse.GetLocaleCodes> {
    return {
      data: [...localeCodes],
      total: localeCodes.length,
    }
  }

  @Get('countries', {
    summary: 'List countries',
    scopes: 'locale.read',
    model: { type: Models.COUNTRY, list: true },
    sdk: {
      name: 'listCountries',
      descMd: '/docs/references/locale/list-countries.md',
    },
  })
  getCountries(
    @Locale() locale: LocaleTranslator,
  ): IListResponse<ILocaleResponse.GetCountries> {
    return {
      data: countries
        .map(c => ({
          name: locale.getText(`countries.${c.toLowerCase()}`),
          code: c,
        }))
        .sort(), // TODO: ------------
      total: countries.length,
    }
  }

  @Get('countries/eu', {
    summary: 'List EU countries',
    scopes: 'locale.read',
    model: { type: Models.COUNTRY, list: true },
    sdk: {
      name: 'listCountriesEU',
      descMd: '/docs/references/locale/list-countries-eu.md',
    },
  })
  getEuCountries(
    @Locale() locale: LocaleTranslator,
  ): IListResponse<ILocaleResponse.GetCountries> {
    return {
      data: euList
        .map(c => ({
          name: locale.getText(`countries.${c.toLowerCase()}`),
          code: c,
        }))
        .sort(), // TODO: ------------
      total: countries.length,
    }
  }

  @Get('countries/phones', {
    summary: 'List countries phone codes',
    scopes: 'locale.read',
    model: { type: Models.PHONE, list: true },
    sdk: {
      name: 'listCountriesPhones',
      descMd: '/docs/references/locale/list-countries-phones.md',
    },
  })
  getCountriesPhone(
    @Locale() locale: LocaleTranslator,
  ): IListResponse<ILocaleResponse.GetCountriesPhone> {
    const list = Object.entries(phoneCodes).sort()
    const data: ILocaleResponse.GetCountriesPhone[] = []

    for (const [name, code] of list) {
      const countryName = locale.getText(
        `countries.${name.toLowerCase()}`,
        false,
      )
      if (!countryName) continue

      data.push({
        code: `+${code}`,
        countryCode: name,
        countryName,
      })
    }

    return {
      data,
      total: data.length,
    }
  }

  @Get('continents', {
    summary: 'List continents',
    scopes: 'locale.read',
    model: { type: Models.CONTINENT, list: true },
    sdk: {
      name: 'listContinents',
      descMd: '/docs/references/locale/list-continents.md',
    },
  })
  getContinents(
    @Locale() locale: LocaleTranslator,
  ): IListResponse<ILocaleResponse.GetContinents> {
    return {
      data: continents
        .map(c => ({
          name: locale.getText(`continents.${c.toLowerCase()}`),
          code: c,
        }))
        .sort(),
      total: continents.length,
    }
  }

  @Get('currencies', {
    summary: 'List currencies',
    scopes: 'locale.read',
    model: { type: Models.CURRENCY, list: true },
    sdk: {
      name: 'listCurrencies',
      descMd: '/docs/references/locale/list-currencies.md',
    },
  })
  getCurrencies(): IListResponse<ILocaleResponse.GetCurrencies> {
    return {
      data: currencies,
      total: currencies.length,
    }
  }

  @Get('languages', {
    summary: 'List languages',
    scopes: 'locale.read',
    model: { type: Models.LANGUAGE, list: true },
    sdk: {
      name: 'listLanguages',
      descMd: '/docs/references/locale/list-languages.md',
    },
  })
  getLanguages(): IListResponse<ILocaleResponse.GetLanguages> {
    return {
      data: languages,
      total: languages.length,
    }
  }
}
