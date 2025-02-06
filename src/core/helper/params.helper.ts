import { Request } from 'express';

/**
 * Helper class to get params from headers or query
 */
class ParamsHelper {
  private req: Request;

  constructor(req: Request) {
    this.req = req;
  }

  get(param: string, defaultValue: any | null = null): string | undefined {
    let value: string | string[] | undefined;

    // Check in headers
    value = this.req.headers[param.toLowerCase()];
    if (value) {
      return this.processValue(value);
    }

    // Check in query
    value = this.req.query[param] as string | string[];
    if (value) {
      return this.processValue(value);
    }

    return defaultValue;
  }

  getFromHeaders(
    param: string,
    defaultValue: any | null = null,
  ): string | undefined {
    const value = this.req.headers[param.toLowerCase()];
    return value ? this.processValue(value) : defaultValue;
  }

  getFromQuery(
    param: string,
    defaultValue: any | null = null,
  ): string | undefined {
    const value = this.req.query[param] as string | string[];
    return value ? this.processValue(value) : defaultValue;
  }

  private processValue(value: string | string[]): string {
    if (Array.isArray(value)) {
      return value[value.length - 1];
    } else if (typeof value === 'string' && value.includes(',')) {
      const parts = value.split(',');
      return parts[parts.length - 1];
    } else {
      return value;
    }
  }
}

export default ParamsHelper;
