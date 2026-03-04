import { Origin } from './origin'
import { Platform } from './platform'

export class RedirectValidator extends Origin {
  /**
   * Get Description
   * @return string
   */
  override get $description(): string {
    const platform = Platform.getNameByScheme(this._scheme)
    const host = this._host ? `(${this._host})` : ''

    if (!this._host && !this._scheme) {
      return 'Invalid URI.'
    }

    return `Invalid URI. Register your new client ${host} as a new ${platform} platform on your project console dashboard`
  }
}
