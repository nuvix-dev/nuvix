import type { Validator } from '@nuvix-tech/db';
import { Platform } from './platform';
import type { PlatformsDoc } from '@nuvix/utils/types';
import { Hostname } from './hostname';

export class Origin implements Validator {
  private hostnames: string[] = [];
  private schemes: string[] = [];
  private scheme: string | undefined;
  private host: string | null = null;
  private origin: string = '';

  /**
   * Constructor
   *
   * @param platforms Array of platform documents
   */
  constructor(platforms: PlatformsDoc[]) {
    this.hostnames = Platform.getHostnames(platforms);
    this.schemes = Platform.getSchemes(platforms);
  }

  /**
   * Check if Origin is valid.
   * @param origin The Origin URI.
   * @return boolean
   */
  public $valid(origin: any): boolean {
    this.origin = origin;
    this.scheme = undefined;
    this.host = null;

    if (typeof origin !== 'string' || !origin) {
      return false;
    }

    this.scheme = this.parseScheme(origin);
    try {
      const url = new URL(origin);
      this.host = url.hostname.toLowerCase();
    } catch {
      this.host = '';
    }

    const webPlatforms = [
      Platform.SCHEME_HTTP,
      Platform.SCHEME_HTTPS,
      Platform.SCHEME_CHROME_EXTENSION,
      Platform.SCHEME_FIREFOX_EXTENSION,
      Platform.SCHEME_SAFARI_EXTENSION,
      Platform.SCHEME_EDGE_EXTENSION,
    ];

    if (this.scheme && webPlatforms.includes(this.scheme)) {
      const validator = new Hostname(this.hostnames);
      return validator.$valid(this.host);
    }

    if (this.scheme && this.schemes.includes(this.scheme)) {
      return true;
    }

    return false;
  }

  /**
   * Get Description
   * @return string
   */
  public get $description(): string {
    const platform = this.scheme ? Platform.getNameByScheme(this.scheme) : '';
    const host = this.host ? `(${this.host})` : '';

    if (!this.host && !this.scheme) {
      return 'Invalid Origin.';
    }

    if (!platform) {
      return `Invalid Scheme. The scheme used (${this.scheme}) in the Origin (${this.origin}) is not supported. If you are using a custom scheme, please change it to \`appwrite-callback-<PROJECT_ID>\``;
    }

    return `Invalid Origin. Register your new client ${host} as a new ${platform} platform on your project console dashboard`;
  }

  /**
   * Parses the scheme from a URI string.
   *
   * @param uri The URI string to parse.
   * @return The extracted scheme string (e.g., "http", "exp", "mailto")
   */
  public parseScheme(uri: string): string | undefined {
    uri = uri.trim();
    if (uri === '') {
      return undefined;
    }

    try {
      const url = new URL(uri);
      return url.protocol.slice(0, -1); // Remove trailing ':'
    } catch {
      const match = uri.match(/^([a-z][a-z0-9+.-]*):/i);
      return match ? match[1] : undefined;
    }
  }
}
