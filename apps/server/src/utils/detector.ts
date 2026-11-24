/**
 * User-agent detection over the `ua-parser-js` engine, mapping into the
 * session/log field shape: osCode/osName/osVersion, clientType/
 * clientCode/clientName/clientVersion/clientEngine/clientEngineVersion,
 * deviceName/deviceBrand/deviceModel.
 */

import { UAParser } from 'ua-parser-js'

export interface DetectorOS {
  osCode: string
  osName: string
  osVersion: string
}

export interface DetectorClient {
  clientType: string
  clientCode: string
  clientName: string
  clientVersion: string
  clientEngine: string
  clientEngineVersion: string
}

export interface DetectorDevice {
  deviceName: string | null
  deviceBrand: string | null
  deviceModel: string | null
}

export class Detector {
  readonly #userAgent: string
  readonly #parser: UAParser

  constructor(userAgent: string) {
    this.#userAgent = userAgent ?? ''
    this.#parser = new UAParser(this.#userAgent)
  }

  getOS(): DetectorOS {
    const os = this.#parser.getOS()
    return {
      osCode: os.name?.toLowerCase().replace(/\s+/g, '_') ?? '',
      osName: os.name ?? '',
      osVersion: os.version ?? '',
    }
  }

  getClient(): DetectorClient {
    if (this.#userAgent.includes('NuvixCLI')) {
      const version = this.#userAgent.split(' ')[0]?.split('/')[1] ?? ''
      return {
        clientType: 'desktop',
        clientCode: 'cli',
        clientName: 'Nuvix CLI',
        clientVersion: version,
        clientEngine: '',
        clientEngineVersion: '',
      }
    }

    const browser = this.#parser.getBrowser()
    const engine = this.#parser.getEngine()
    return {
      clientType: 'browser',
      clientCode: browser.name?.toLowerCase().replace(/\s+/g, '_') ?? '',
      clientName: browser.name ?? '',
      clientVersion: browser.version ?? '',
      clientEngine: engine.name ?? '',
      clientEngineVersion: engine.version ?? '',
    }
  }

  getDevice(): DetectorDevice {
    const device = this.#parser.getDevice()
    return {
      deviceName: device.type ?? null,
      deviceBrand: device.vendor ?? null,
      deviceModel: device.model ?? null,
    }
  }
}
