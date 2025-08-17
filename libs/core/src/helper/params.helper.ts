/**
 * Helper class to get params from headers or query
 */
class ParamsHelper {
  private req: NuvixRequest;

  constructor(req: NuvixRequest) {
    this.req = req;
  }

  /**
   * Get a request parameter from headers or query
   * the parameter name is prefixed with `x-nuvix-` in headers
   * and can be accessed directly in query.
   * If the parameter is not found, it returns the default value.
   */
  get<T extends any = null>(
    param: string,
    defaultValue = null,
  ): T | string | string[] | undefined {
    let value: string | string[] | undefined;
    let headerParam = `x-nuvix-${param.toLowerCase()}`;
    // Check in headers
    value = this.req.headers[headerParam];
    if (value) {
      return this.processValue(value);
    }

    // Check in query
    value = this.getQueryParams()[param];
    if (value) {
      return this.processValue(value);
    }

    return defaultValue as T;
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
    const value = this.getQueryParams()[param];
    return value ? this.processValue(value) : defaultValue;
  }

  private processValue(value: string | string[]): string {
    if (Array.isArray(value)) {
      return value[value.length - 1]!;
    } else if (typeof value === 'string' && value.includes(',')) {
      const parts = value.split(',');
      return parts[parts.length - 1]!;
    } else {
      return value;
    }
  }

  private getQueryParams(): Record<string, string | string[]> {
    // const url = new URL(this.req.url || '', `http://${this.req.headers.host || 'localhost'}${this.req.url}`);
    // const params: Record<string, string | string[]> = {};

    // url.searchParams.forEach((value, key) => {
    //   if (params[key]) {
    //     if (Array.isArray(params[key])) {
    //       (params[key] as string[]).push(value);
    //     } else {
    //       params[key] = [params[key] as string, value];
    //     }
    //   } else {
    //     params[key] = value;
    //   }
    // });

    return this.req.query as any;
  }
}

export default ParamsHelper;
