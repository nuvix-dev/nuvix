/** Projection helpers: user, target, session, membership, and token documents to API shapes. */
import type {
  MembershipsDoc,
  SessionsDoc,
  TargetsDoc,
  TokensDoc,
  UsersDoc,
} from '../types/generated'

/** API-projected user (delivery targets inlined). */
export interface UserView {
  $id: string
  $createdAt: string
  $updatedAt: string
  name: string
  email: string
  phone: string
  status: boolean
  labels: string[]
  passwordUpdate: string
  registration: string
  emailVerification: boolean
  phoneVerification: boolean
  mfa: boolean
  prefs: Record<string, unknown>
  accessedAt: string
  targets: TargetView[]
}

/** API-projected push/messaging target. */
export interface TargetView {
  $id: string
  $createdAt: string
  $updatedAt: string
  userId: string
  providerType: string
  providerId: string
  identifier: string
  name: string
  expired: boolean
}

/** API-projected session; `current` marks the caller's own session. */
export interface SessionView {
  $id: string
  $createdAt: string
  $updatedAt: string
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
  countryName: string
  current: boolean
  factors: string[]
  secret: string
  mfaUpdatedAt: string
}

/** API-projected team membership. */
export interface MembershipView {
  $id: string
  $createdAt: string
  $updatedAt: string
  userId: string
  teamId: string
  teamName: string
  userName: string
  userEmail: string
  invited: string
  joined: string
  confirm: boolean
  roles: string[]
}

/** API-projected verification token (secret omitted). */
export interface TokenView {
  $id: string
  $createdAt: string
  userId: string
  type: number | string
  expire: string
  phrase: string
  secret?: string
}

/** Map a target document to its API projection. */
export function formatTarget(doc: TargetsDoc): TargetView {
  return {
    $id: doc.getId(),
    $createdAt: doc.createdAt()?.toISOString() ?? '',
    $updatedAt: doc.updatedAt()?.toISOString() ?? '',
    userId: doc.get('userId') ?? '',
    providerType: doc.get('providerType') ?? '',
    providerId: doc.get('providerId') ?? '',
    identifier: doc.get('identifier') ?? '',
    name: doc.get('name') ?? '',
    expired: doc.get('expired') ?? false,
  }
}

/** Map a session document, flagging the caller's current session. */
export function formatSession(doc: SessionsDoc, currentSessionId?: string): SessionView {
  return {
    $id: doc.getId(),
    $createdAt: doc.createdAt()?.toISOString() ?? '',
    $updatedAt: doc.updatedAt()?.toISOString() ?? '',
    userId: doc.get('userId') ?? '',
    expire: (doc.get('expire') as string | Date)?.toString() ?? '',
    provider: doc.get('provider') ?? '',
    providerUid: doc.get('providerUid') ?? '',
    providerAccessToken: doc.get('providerAccessToken') ?? '',
    providerAccessTokenExpiry:
      (doc.get('providerAccessTokenExpiry') as string | Date)?.toString() ?? '',
    providerRefreshToken: doc.get('providerRefreshToken') ?? '',
    ip: doc.get('ip') ?? '',
    osCode: doc.get('osCode') ?? '',
    osName: doc.get('osName') ?? '',
    osVersion: doc.get('osVersion') ?? '',
    clientType: doc.get('clientType') ?? '',
    clientCode: doc.get('clientCode') ?? '',
    clientName: doc.get('clientName') ?? '',
    clientVersion: doc.get('clientVersion') ?? '',
    clientEngine: doc.get('clientEngine') ?? '',
    clientEngineVersion: doc.get('clientEngineVersion') ?? '',
    deviceName: doc.get('deviceName') ?? '',
    deviceBrand: doc.get('deviceBrand') ?? '',
    deviceModel: doc.get('deviceModel') ?? '',
    countryCode: doc.get('countryCode') ?? '',
    countryName: doc.get('countryName') ?? '',
    current: currentSessionId ? doc.getId() === currentSessionId : false,
    factors: (doc.get('factors') as string[]) ?? [],
    secret: '', // sensitive field
    mfaUpdatedAt: (doc.get('mfaUpdatedAt') as string | Date)?.toString() ?? '',
  }
}

/** Map a membership document to its API projection. */
export function formatMembership(doc: MembershipsDoc): MembershipView {
  return {
    $id: doc.getId(),
    $createdAt: doc.createdAt()?.toISOString() ?? '',
    $updatedAt: doc.updatedAt()?.toISOString() ?? '',
    userId: doc.get('userId') ?? '',
    teamId: doc.get('teamId') ?? '',
    teamName: doc.get('teamName') ?? '',
    userName: doc.get('userName') ?? '',
    userEmail: doc.get('userEmail') ?? '',
    invited: (doc.get('invited') as string | Date)?.toString() ?? '',
    joined: (doc.get('joined') as string | Date)?.toString() ?? '',
    confirm: doc.get('confirm') ?? false,
    roles: (doc.get('roles') as string[]) ?? [],
  }
}

/** Map a token document to its API projection. */
export function formatToken(doc: TokensDoc): TokenView {
  return {
    $id: doc.getId(),
    $createdAt: doc.createdAt()?.toISOString() ?? '',
    userId: doc.get('userId') ?? '',
    type: doc.get('type') ?? 0,
    expire: (doc.get('expire') as string | Date)?.toString() ?? '',
    phrase: doc.get('phrase') ?? '',
  }
}

/** Map a user document (and its targets) to the API projection. */
export function formatUser(user: UsersDoc, targets: TargetsDoc[] = []): UserView {
  return {
    $id: user.getId(),
    $createdAt: user.createdAt()?.toISOString() ?? '',
    $updatedAt: user.updatedAt()?.toISOString() ?? '',
    name: user.get('name') ?? '',
    email: user.get('email') ?? '',
    phone: user.get('phone') ?? '',
    status: user.get('status') ?? true,
    labels: (user.get('labels') as string[]) ?? [],
    passwordUpdate: (user.get('passwordUpdate') as string | Date)?.toString() ?? '',
    registration: (user.get('registration') as string | Date)?.toString() ?? '',
    emailVerification: user.get('emailVerification') ?? false,
    phoneVerification: user.get('phoneVerification') ?? false,
    mfa: user.get('mfa') ?? false,
    prefs: (user.get('prefs') ?? {}) as Record<string, unknown>,
    accessedAt: (user.get('accessedAt') as string | Date)?.toString() ?? '',
    targets: targets.map(formatTarget),
  }
}
