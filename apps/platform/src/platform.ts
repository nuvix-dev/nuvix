import { Doc } from '@nuvix/db'

export const platform = new Doc<Platform>({
  name: 'platform',
})

interface Platform {
  authWhitelistIPs: string[]
  authWhitelistEmails: string[]
  auths: {
    limit: number
    personalDataCheck: boolean
    duration: number
    sessionAlerts: boolean
  }
}
