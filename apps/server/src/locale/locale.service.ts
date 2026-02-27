import { Injectable } from '@nestjs/common'
import { CoreService } from '@nuvix/core'
import { currencies, euList } from '@nuvix/core/config'
import type { CountryResponse, Reader } from 'maxmind'
import type { ILocaleResponse, TLocalService } from './locale.types'

@Injectable()
export class LocaleService {
  private readonly geoDb: Reader<CountryResponse>

  constructor(private readonly coreService: CoreService) {
    this.geoDb = this.coreService.getGeoDb()
  }

  getUserLocale({
    ip,
    locale,
  }: TLocalService.GetUserLocale): ILocaleResponse.GetUserLocale {
    const defaultValue = locale.getText('locale.country.unknown')
    const output: ILocaleResponse.GetUserLocale = {
      ip,
      countryCode: '--',
      country: defaultValue,
      continent: defaultValue,
      continentCode: '--',
      eu: false,
      currency: null,
    }

    const record = this.geothis.db.get(ip)

    if (record) {
      const countryCode = record.country?.iso_code
      const continentCode = record.continent?.code
      output.countryCode = countryCode ?? '--'
      output.continentCode = continentCode ?? '--'

      output.country = locale.getText(
        `countries.${countryCode?.toLowerCase()}`,
        defaultValue,
      )
      output.continent = locale.getText(
        `continents.${continentCode?.toLowerCase()}`,
        defaultValue,
      )

      output.eu = !!(continentCode && euList.includes(continentCode))

      if (countryCode) {
        output.currency =
          currencies
            .filter(c => c.code && c.locations.length)
            .find(c => c.locations.includes(countryCode.toUpperCase()))?.code ??
          null
      }
    }

    return output
  }
}
