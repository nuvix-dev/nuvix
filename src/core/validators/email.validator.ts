
export class EmailValidator {

  private allowEmpty: boolean;

  constructor(allowEmpty: boolean = false) {
    this.allowEmpty = allowEmpty;
  }

  /**
   * Get Description
   *
   * Returns validator description
   *
   * @return string
   */
  getDescription(): string {
    return 'Value must be a valid email address';
  }

  /**
   * Is valid
   *
   * Validation will pass when value is a valid email address.
   *
   * @param value
   * @return boolean
   */
  isValid(value: any): boolean {
    if (this.allowEmpty && value.length === 0) {
      return true;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }
}