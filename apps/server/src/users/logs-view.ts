/**
 * User activity-log view, shared by the users/teams/collections `logs`
 * endpoints: audit event + acting user + detected client/OS/device
 * fields + geoip country.
 */
export interface LogView {
  event: string
  userId: string
  userEmail: string | null
  userName: string | null
  ip: string
  time: string
  osCode: string
  osName: string
  osVersion: string
  clientType: string
  clientCode: string
  clientName: string
  clientVersion: string
  clientEngine: string
  clientEngineVersion: string
  deviceName: string | null
  deviceBrand: string | null
  deviceModel: string | null
  countryCode?: string
  countryName: string
}
