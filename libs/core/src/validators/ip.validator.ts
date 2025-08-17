import { Validator } from '@nuvix-tech/db';

export class IPValidator implements Validator {
  static readonly ALL = 'all';
  static readonly V4 = 'ipv4';
  static readonly V6 = 'ipv6';

  private type: string;

  constructor(type: string = IPValidator.ALL) {
    if (![IPValidator.ALL, IPValidator.V4, IPValidator.V6].includes(type)) {
      throw new Error('Unsupported IP type');
    }
    this.type = type;
  }

  $description: string = 'Value must be a valid IP address';

  $valid(value: any): boolean {
    switch (this.type) {
      case IPValidator.ALL:
        return this.validateIP(value);
      case IPValidator.V4:
        return this.validateIPv4(value);
      case IPValidator.V6:
        return this.validateIPv6(value);
      default:
        return false;
    }
  }

  private validateIP(value: any): boolean {
    const ipRegex =
      /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4}|:)$/;
    return ipRegex.test(value) || ipv6Regex.test(value);
  }

  private validateIPv4(value: any): boolean {
    const ipRegex =
      /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(value);
  }

  private validateIPv6(value: any): boolean {
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4}|:)$/;
    return ipv6Regex.test(value);
  }
}
