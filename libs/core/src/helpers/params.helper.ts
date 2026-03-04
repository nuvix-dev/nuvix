/**
 * Helper class to get parameters from headers or query string.
 */
class ParamsHelper {
  private readonly req: NuvixRequest

  constructor(req: NuvixRequest) {
    this.req = req
  }

  /**
   * Retrieves a parameter from headers (with `x-nuvix-` prefix) or query string.
   * @param param Parameter name (case-insensitive for headers)
   * @param defaultValue Value to return if parameter is not found
   * @returns The parameter value, or defaultValue if not found
   */
  get<T = string | undefined>(param: string, defaultValue?: T): string | T {
    const headerParam = `x-nuvix-${param.toLowerCase()}`
    const headerValue = this.req.headers[headerParam]
    if (headerValue !== undefined) {
      return this.processValue(headerValue) as string
    }

    const queryValue = this.getQueryParams()[param]
    if (queryValue !== undefined) {
      return this.processValue(queryValue) as string
    }

    return defaultValue as T
  }

  /**
   * Retrieves a parameter only from headers (case-insensitive).
   * @param param Header parameter name
   * @param defaultValue Value to return if parameter is not found
   */
  getFromHeaders<T = string | undefined>(
    param: string,
    defaultValue?: T,
  ): string | T {
    const value = this.req.headers[param.toLowerCase()]
    return value !== undefined
      ? (this.processValue(value) as string)
      : (defaultValue as T)
  }

  /**
   * Retrieves a parameter only from query string.
   * @param param Query parameter name
   * @param defaultValue Value to return if parameter is not found
   */
  getFromQuery<T = string | undefined>(
    param: string,
    defaultValue?: T,
  ): string | T {
    const value = this.getQueryParams()[param]
    return value !== undefined
      ? (this.processValue(value) as string)
      : (defaultValue as T)
  }

  /**
   * Processes a value from headers or query, returning the last value if array or comma-separated.
   * @param value The value to process
   */
  private processValue(value: string | string[]): string {
    if (Array.isArray(value)) {
      return value[value.length - 1] ?? ''
    }
    if (typeof value === 'string' && value.includes(',')) {
      const parts = value.split(',')
      return parts[parts.length - 1]!.trim()
    }
    return value
  }

  /**
   * Returns the parsed query parameters.
   */
  private getQueryParams() {
    return this.req.query as Record<string, string | string[]>
  }
}

export default ParamsHelper
