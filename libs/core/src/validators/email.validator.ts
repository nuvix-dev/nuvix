import { Validator } from '@nuvix/db'

export class EmailValidator implements Validator {
  private allowEmpty: boolean

  constructor(allowEmpty = false) {
    this.allowEmpty = allowEmpty
  }

  get $description(): string {
    return 'Value must be a valid email address'
  }

  /**
   * Is valid
   *
   * Validation will pass when value is a valid email address.
   *
   * @param value
   * @return boolean
   */
  $valid(value: any): boolean {
    if (this.allowEmpty && value.length === 0) {
      return true
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value)
  }
}
