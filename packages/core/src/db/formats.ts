/**
 * Shared `@nuvix/db` attribute formats. Formats attach a named validator to
 * an attribute type; the document plane consults the registry whenever an
 * attribute declares `format` (and validates `default` and written values
 * against it).
 */

import {
  AttributeType,
  DatetimeValidator,
  type Format,
  NumericType,
  RangeValidator,
  StructureValidator,
  type Validator,
} from '@nuvix/db'
import { AttributeFormat } from '@nuvix/utils'

/** Accepts email addresses (parity with v1 `EmailValidator`). */
class EmailValidator implements Validator {
  constructor(private readonly allowEmpty = false) {}

  get $description(): string {
    return 'Value must be a valid email address'
  }

  $valid(value: any): boolean {
    if (this.allowEmpty && value.length === 0) {
      return true
    }
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  }
}

const IPV4_PATTERN =
  /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)$/
const IPV6_PATTERN = /^([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4}|:)$/

/** Validates IPv4/IPv6 literals (parity with v1 `IPValidator`). */
class IPValidator implements Validator {
  static readonly ALL = 'all'
  static readonly V4 = 'ipv4'
  static readonly V6 = 'ipv6'

  constructor(private readonly kind: string = IPValidator.ALL) {
    if (![IPValidator.ALL, IPValidator.V4, IPValidator.V6].includes(kind)) {
      throw new Error('Unsupported IP type')
    }
  }

  get $description(): string {
    return 'Value must be a valid IP address'
  }

  $valid(value: any): boolean {
    switch (this.kind) {
      case IPValidator.ALL:
        return IPV4_PATTERN.test(value) || IPV6_PATTERN.test(value)
      case IPValidator.V4:
        return IPV4_PATTERN.test(value)
      case IPValidator.V6:
        return IPV6_PATTERN.test(value)
      default:
        return false
    }
  }
}

/** Validates absolute URLs, optionally restricted to allowed schemes (parity with v1 `URLValidator`). */
class URLValidator implements Validator {
  constructor(private readonly allowedSchemes: string[] = []) {}

  get $description(): string {
    return this.allowedSchemes.length > 0
      ? `Value must be a valid URL with following schemes (${this.allowedSchemes.join(', ')})`
      : 'Value must be a valid URL'
  }

  $valid(value: any): boolean {
    try {
      const url = new URL(value)
      if (
        this.allowedSchemes.length > 0 &&
        !this.allowedSchemes.includes(url.protocol.replace(':', ''))
      ) {
        return false
      }
      return true
    } catch {
      return false
    }
  }
}

/** Accepts only values from a fixed list; case-insensitive unless strict (parity with v1 `WhiteList`). */
class WhiteList implements Validator {
  private readonly list: string[]

  constructor(list: string[], strict = false) {
    this.list = strict ? list : list.map((value) => value.toLowerCase())
  }

  get $description(): string {
    return `Value must be one of (${this.list.join(', ')})`
  }

  $valid(value: any): boolean {
    if (Array.isArray(value)) {
      return false
    }
    return this.list.includes(typeof value === 'string' ? value.toLowerCase() : value)
  }
}

/** Every core attribute format, keyed by `AttributeFormat` (v1 parity). */
const coreFormats: Record<string, Format> = {
  [AttributeFormat.EMAIL]: {
    type: AttributeType.String,
    callback: () => new EmailValidator(),
  },
  [AttributeFormat.DATETIME]: {
    type: AttributeType.Timestamptz,
    callback: () => new DatetimeValidator(),
  },
  [AttributeFormat.ENUM]: {
    type: AttributeType.String,
    callback: (attribute: any) => new WhiteList(attribute?.formatOptions?.elements ?? [], true),
  },
  [AttributeFormat.IP]: {
    type: AttributeType.String,
    callback: () => new IPValidator(),
  },
  [AttributeFormat.URL]: {
    type: AttributeType.String,
    callback: () => new URLValidator(),
  },
  [AttributeFormat.INTEGER]: {
    type: AttributeType.Integer,
    callback: (attribute: any) =>
      new RangeValidator(
        attribute?.formatOptions?.min ?? Number.NEGATIVE_INFINITY,
        attribute?.formatOptions?.max ?? Number.POSITIVE_INFINITY,
        NumericType.INTEGER,
      ),
  },
  [AttributeFormat.FLOAT]: {
    type: AttributeType.Float,
    callback: (attribute: any) =>
      new RangeValidator(
        attribute?.formatOptions?.min ?? Number.NEGATIVE_INFINITY,
        attribute?.formatOptions?.max ?? Number.POSITIVE_INFINITY,
        NumericType.FLOAT,
      ),
  },
}

/**
 * Register every core attribute format with the shared `@nuvix/db` registry.
 * Idempotent: re-registration simply overwrites with identical definitions.
 * Must run before any collection/attribute operation that declares a
 * `format` (see `Structure.hasFormat`) — wired alongside
 * `registerCoreDbFilters` in the composition roots.
 */
export function registerCoreDbFormats(): void {
  for (const [name, format] of Object.entries(coreFormats)) {
    StructureValidator.addFormat(name, format)
  }
}
