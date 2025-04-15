export class URLValidator {
  private allowedSchemes: string[];

  constructor(allowedSchemes: string[] = []) {
    this.allowedSchemes = allowedSchemes;
  }

  /**
   * Get Description
   *
   * Returns validator description
   *
   * @return string
   */
  public getDescription(): string {
    if (this.allowedSchemes.length > 0) {
      return `Value must be a valid URL with following schemes (${this.allowedSchemes.join(', ')})`;
    }

    return 'Value must be a valid URL';
  }

  /**
   * Is valid
   *
   * Validation will pass when value is valid URL.
   *
   * @param  value
   * @return boolean
   */
  public isValid(value: any): boolean {
    try {
      const url = new URL(value);
      if (
        this.allowedSchemes.length > 0 &&
        !this.allowedSchemes.includes(url.protocol.replace(':', ''))
      ) {
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }
}
