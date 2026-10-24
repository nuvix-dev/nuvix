/**
 * Session document metadata derived from the caller user-agent (v1 parity:
 * every session records osCode/osName/osVersion, client*, device* fields).
 */
import { Detector } from './detector'

export function sessionDetectorFields(userAgent?: string): Record<string, unknown> {
  const detector = new Detector(userAgent ?? 'UNKNOWN')
  return {
    ...detector.getOS(),
    ...detector.getClient(),
    ...detector.getDevice(),
  }
}
