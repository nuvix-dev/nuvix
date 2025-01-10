import { UAParser } from 'ua-parser-js';

export class Detector {
  private userAgent: string;
  private parser: UAParser;

  constructor(userAgent: string) {
    this.userAgent = userAgent;
    this.parser = new UAParser(userAgent);
  }

  /**
   * Get OS info
   *
   * @returns OS information as an object.
   */
  getOS(): Record<string, string> {
    const os = this.parser.getOS();

    return {
      osCode: os.name?.toLowerCase().replace(/\s+/g, '_') || '',
      osName: os.name || '',
      osVersion: os.version || '',
    };
  }

  /**
   * Get client info
   *
   * @returns Client information as an object.
   */
  getClient(): Record<string, string> {
    let client;

    if (this.userAgent.includes('NuvixCLI')) {
      const version = this.userAgent.split(' ')[0]?.split('/')[1] || '';
      client = {
        type: 'desktop',
        short_name: 'cli',
        name: 'Nuvix CLI',
        version: version,
      };
    } else {
      const browser = this.parser.getBrowser();
      const engine = this.parser.getEngine();

      client = {
        type: 'browser',
        short_name: browser.name?.toLowerCase().replace(/\s+/g, '_') || '',
        name: browser.name || '',
        version: browser.version || '',
        engine: engine.name || '',
        engine_version: engine.version || '',
      };
    }

    return {
      clientType: client.type || '',
      clientCode: client.short_name || '',
      clientName: client.name || '',
      clientVersion: client.version || '',
      clientEngine: client.engine || '',
      clientEngineVersion: client.engine_version || '',
    };
  }

  /**
   * Get device info
   *
   * @returns Device information as an object.
   */
  getDevice(): Record<string, string | null> {
    const device = this.parser.getDevice();

    return {
      deviceName: device.type || null,
      deviceBrand: device.vendor || null,
      deviceModel: device.model || null,
    };
  }

  /**
   * Skip bot detection
   *
   * Note: This method is not applicable to UAParser since bot detection is not supported directly.
   * Included for consistency with the original PHP class.
   *
   * @param skip Always true for compatibility.
   */
  skipBotDetection(skip = true): void {
    console.warn('Bot detection skipping is not supported in UAParser.');
  }
}
