import type { Validator } from '@nuvix/db'
import type { PlatformsDoc } from '@nuvix/utils/types'
import { Hostname } from './hostname'
import { Platform } from './platform'

export class Origin implements Validator {
  protected hostnames: string[] = []
  protected schemes: string[] = []
  protected _scheme: string | undefined
  protected _host: string | null = null
  protected _origin = ''

  /**
   * Constructor
   */
  constructor(platforms: PlatformsDoc[])
  constructor(allowedHostnames: string[], allowedSchemas: string[])
  constructor(
    platformsOrHostnames: PlatformsDoc[] | string[],
    allowedSchemas?: string[],
  ) {
    if (allowedSchemas === undefined) {
      // Called with platforms overload
      this.hostnames = Platform.getHostnames(
        platformsOrHostnames as PlatformsDoc[],
      )
      this.schemes = Platform.getSchemes(platformsOrHostnames as PlatformsDoc[])
    } else {
      this.hostnames = platformsOrHostnames as string[]
      this.schemes = allowedSchemas
    }
  }

  /**
   * Check if Origin is valid.
   * @param origin The Origin URI.
   * @return boolean
   */
  private static readonly WEB_PLATFORMS = new Set([
    Platform.SCHEME_HTTP,
    Platform.SCHEME_HTTPS,
    Platform.SCHEME_CHROME_EXTENSION,
    Platform.SCHEME_FIREFOX_EXTENSION,
    Platform.SCHEME_SAFARI_EXTENSION,
    Platform.SCHEME_EDGE_EXTENSION,
  ])

  public $valid(origin: any): boolean {
    this._origin = origin
    this._scheme = undefined
    this._host = null

    if (typeof origin !== 'string' || !origin) {
      return false
    }

    this._scheme = this.parseScheme(origin)
    try {
      const url = new URL(origin)
      this._host = url.hostname.toLowerCase()
    } catch {
      this._host = ''
    }

    if (this._scheme && Origin.WEB_PLATFORMS.has(this._scheme)) {
      const validator = new Hostname(this.hostnames)
      return validator.$valid(this._host)
    }

    if (this._scheme && this.schemes.includes(this._scheme)) {
      return true
    }

    return false
  }

  /**
   * Get Description
   * @return string
   */
  public get $description(): string {
    const platform = this._scheme ? Platform.getNameByScheme(this._scheme) : ''
    const host = this._host ? `(${this._host})` : ''

    if (!this._host && !this._scheme) {
      return 'Invalid Origin.'
    }

    if (!platform) {
      return `Invalid Scheme. The scheme used (${this._scheme}) in the Origin (${this._origin}) is not supported. If you are using a custom scheme, please change it to \`nuvix-callback-<PROJECT_ID>\``
    }

    return `Invalid Origin. Register your new client ${host} as a new ${platform} platform on your project console dashboard`
  }

  /**
   * Parses the scheme from a URI string.
   *
   * @param uri The URI string to parse.
   * @return The extracted scheme string (e.g., "http", "exp", "mailto")
   */
  public parseScheme(uri: string): string | undefined {
    uri = uri.trim()
    if (uri === '') {
      return undefined
    }

    try {
      const url = new URL(uri)
      return url.protocol.slice(0, -1) // Remove trailing ':'
    } catch {
      const match = uri.match(/^([a-z][a-z0-9+.-]*):/i)
      return match ? match[1] : undefined
    }
  }
}
