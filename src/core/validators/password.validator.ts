
export class PasswordValidator {
  private allowEmpty: boolean;

  constructor(allowEmpty: boolean = false) {
    this.allowEmpty = allowEmpty;
  }

  /**
   * Get Description
   *
   * Returns validator description
   */
  getDescription(): string {
    return 'Password must be between 8 and 256 characters long.';
  }

  /**
   * Is Valid
   *
   * Validates the given value.
   *
   * @param value - The value to validate.
   */
  isValid(value: unknown): boolean {
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

  /**
   * Is Array
   *
   * Indicates if the validator works on arrays.
   */
  isArray(): boolean {
    return false;
  }

  /**
   * Get Type
   *
   * Returns validator type.
   */
  getType(): string {
    return 'string'; // Equivalent to `self::TYPE_STRING` in PHP
  }
}
