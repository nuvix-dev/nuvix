import { Origin } from './origin'
import { Platform } from './platform'

export class RedirectValidator extends Origin {
  /**
   * Get Description
   * @return string
   */
  override get $description(): string {
    const platform = Platform.getNameByScheme(this.scheme)
    const host = this.host ? `(${this.host})` : ''

    if (!this.host && !this.scheme) {
      return 'Invalid URI.'
    }

    return `Invalid URI. Register your new client ${host} as a new ${platform} platform on your project console dashboard`
  }
}
