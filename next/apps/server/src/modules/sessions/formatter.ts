import type { SessionsDoc } from '../../types/generated'

export interface SessionView {
  $id: string
  $createdAt?: string
  $updatedAt?: string
  userId: string
  expire: string
  provider: string
  providerUid: string
  providerAccessToken: string
  providerAccessTokenExpiry: string
  providerRefreshToken: string
  ip: string
  osCode: string
  osName: string
  osVersion: string
  clientType: string
  clientCode: string
  clientName: string
  clientVersion: string
  clientEngine: string
  clientEngineVersion: string
  deviceName: string
  deviceBrand: string
  deviceModel: string
  countryCode: string
  current: boolean
  factors: string[]
  secret?: string
}

export function formatSession(
  session: SessionsDoc,
  options: {
    secret?: string
    currentSessionId?: string
  } = {},
): SessionView {
  const createdAt = session.get('$createdAt')
  const updatedAt = session.get('$updatedAt')
  const expire = session.get('expire')
  const expiry = session.get('providerAccessTokenExpiry')

  const sessionId = session.getId()
  const isCurrent = options.currentSessionId !== undefined && options.currentSessionId === sessionId

  return {
    $id: sessionId,
    $createdAt: createdAt ? String(createdAt) : undefined,
    $updatedAt: updatedAt ? String(updatedAt) : undefined,
    userId: session.get('userId'),
    expire: expire ? String(expire) : '',
    provider: session.get('provider') ?? 'email',
    providerUid: session.get('providerUid') ?? '',
    providerAccessToken: session.get('providerAccessToken') ?? '',
    providerAccessTokenExpiry: expiry ? String(expiry) : '',
    providerRefreshToken: session.get('providerRefreshToken') ?? '',
    ip: session.get('ip') ?? '',
    osCode: session.get('osCode') ?? '',
    osName: session.get('osName') ?? '',
    osVersion: session.get('osVersion') ?? '',
    clientType: session.get('clientType') ?? '',
    clientCode: session.get('clientCode') ?? '',
    clientName: session.get('clientName') ?? '',
    clientVersion: session.get('clientVersion') ?? '',
    clientEngine: session.get('clientEngine') ?? '',
    clientEngineVersion: session.get('clientEngineVersion') ?? '',
    deviceName: session.get('deviceName') ?? '',
    deviceBrand: session.get('deviceBrand') ?? '',
    deviceModel: session.get('deviceModel') ?? '',
    countryCode: session.get('countryCode') ?? '',
    current: isCurrent,
    factors: (session.get('factors') ?? []) as string[],
    secret: options.secret,
  }
}
