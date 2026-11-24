/**
 * Session document metadata derived from the caller user-agent: every
 * session records osCode/osName/osVersion, client*, and device* fields.
 */
import { Detector } from './detector'

/** Flatten detected OS/client/device fields into one record. */
export function sessionDetectorFields(userAgent?: string): Record<string, unknown> {
  const detector = new Detector(userAgent ?? 'UNKNOWN')
  return {
    ...detector.getOS(),
    ...detector.getClient(),
    ...detector.getDevice(),
  }
}
