import type { Validator } from '@nuvix-tech/db';

export class PasswordValidator implements Validator {
  private allowEmpty: boolean;

  constructor(allowEmpty: boolean = false) {
    this.allowEmpty = allowEmpty;
  }

  $description: string = 'Password must be between 8 and 256 characters long.';

  /**
   * Is Valid
   *
   * Validates the given value.
   *
   * @param value - The value to validate.
   */
  $valid(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    if (this.allowEmpty && value.length === 0) {
      return true;
    }

    if (value.length < 8 || value.length > 256) {
      return false;
    }

    return true;
  }
}
