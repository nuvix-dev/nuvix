import { Doc } from '@nuvix/db'

export const platform = new Doc<Platform>({
  name: 'platform',
  auths: {
    limit: 1,
    personalDataCheck: false,
    duration: 30 * 24 * 60 * 60, // 30 days in seconds
    sessionAlerts: true,
  },
})

interface Platform {
  authWhitelistIPs?: string[]
  authWhitelistEmails?: string[]
  auths: {
    limit: number
    personalDataCheck: boolean
    duration: number
    sessionAlerts: boolean
  }
}
