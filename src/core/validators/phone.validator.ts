
export class PhoneValidator {
  private allowEmpty: boolean;

  constructor(allowEmpty: boolean = false) {
    this.allowEmpty = allowEmpty;
  }

  /**
   * Get Description.
   *
   * Returns validator description
   *
   * @return string
   */
  getDescription(): string {
    return "Phone number must start with a '+' and can have a maximum of fifteen digits.";
  }

  /**
   * Is valid.
   *
   * @param value
   *
   * @return boolean
   */
  isValid(value: any): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    if (this.allowEmpty && value.length === 0) {
      return true;
    }

    const regex = /^\+[1-9]\d{6,14}$/;
    return regex.test(value);
  }

}