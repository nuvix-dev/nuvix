// This file is auto-generated. Do not edit manually.
// Generated on: 2026-09-24T02:47:22.374Z

import type { Doc } from '@nuvix/db'

export interface IEntity {
  $id: string
  $createdAt: Date
  $updatedAt: Date
  $permissions: string[]
  $sequence: number
  $collection: string
  $tenant?: number | null // Optional tenant ID for multi-tenant support
  $schema?: string // Optional schema where the entity is stored
}

export interface Users extends IEntity {
  /** @optional */
  name?: string
  /** @optional */
  email?: string
  /** @optional */
  phone?: string
  /** @optional */
  status?: boolean
  /**
   * @array
   * @optional
   */
  labels?: string[]
  /**
   * @array
   * @optional
   */
  passwordHistory?: string[]
  /**
   * @filter encrypt
   * @optional
   */
  password?: string
  /**
   * @optional
   * @default "argon2id"
   */
  hash?: string | 'argon2id'
  /**
   * @filter json
   * @optional
   */
  hashOptions?: Record<string, unknown>
  /** @optional */
  passwordUpdate?: Date
  /**
   * @filter json
   * @optional
   * @default {}
   */
  prefs?: Record<string, unknown>
  /** @optional */
  registration?: Date
  /** @optional */
  emailVerification?: boolean
  /** @optional */
  phoneVerification?: boolean
  /** @optional */
  reset?: boolean
  /** @optional */
  mfa?: boolean
  /**
   * @filter encrypt
   * @array
   * @optional
   * @default []
   */
  mfaRecoveryCodes?: string[]
  /**
   * @filter subQueryAuthenticators
   * @optional
   */
  authenticators?: Authenticators[]
  /**
   * @filter subQuerySessions
   * @optional
   */
  sessions?: Sessions[]
  /**
   * @filter subQueryTokens
   * @optional
   */
  tokens?: Tokens[]
  /**
   * @filter subQueryMemberships
   * @optional
   */
  memberships?: Memberships[]
  /**
   * @filter subQueryTargets
   * @optional
   */
  targets?: Targets[]
  /**
   * @filter userSearch
   * @optional
   */
  search?: string
  /** @optional */
  accessedAt?: Date
}

export interface Sessions extends IEntity {
  /** @required */
  userInternalId: number
  /** @optional */
  userId?: string
  /** @optional */
  provider?: string
  /** @optional */
  providerUid?: string
  /**
   * @filter encrypt
   * @optional
   */
  providerAccessToken?: string
  /** @optional */
  providerAccessTokenExpiry?: Date
  /**
   * @filter encrypt
   * @optional
   */
  providerRefreshToken?: string
  /**
   * @filter encrypt
   * @optional
   */
  secret?: string
  /** @optional */
  userAgent?: string
  /** @optional */
  ip?: string
  /** @optional */
  countryCode?: string
  /** @optional */
  osCode?: string
  /** @optional */
  osName?: string
  /** @optional */
  osVersion?: string
  /** @optional */
  clientType?: string
  /** @optional */
  clientCode?: string
  /** @optional */
  clientName?: string
  /** @optional */
  clientVersion?: string
  /** @optional */
  clientEngine?: string
  /** @optional */
  clientEngineVersion?: string
  /** @optional */
  deviceName?: string
  /** @optional */
  deviceBrand?: string
  /** @optional */
  deviceModel?: string
  /**
   * @array
   * @optional
   * @default []
   */
  factors?: string[]
  /** @required */
  expire: Date
  /** @optional */
  mfaUpdatedAt?: Date
  /**
   * @filter subQueryTokens
   * @optional
   */
  tokens?: Tokens[]
}

export interface Tokens extends IEntity {
  /** @required */
  userInternalId: number
  /** @optional */
  userId?: string
  /** @required */
  type: number
  /**
   * @filter encrypt
   * @optional
   */
  secret?: string
  /** @optional */
  expire?: Date
  /** @optional */
  userAgent?: string
  /** @optional */
  ip?: string
}

export interface Authenticators extends IEntity {
  /** @optional */
  userInternalId?: number
  /** @optional */
  userId?: string
  /** @optional */
  type?: string
  /**
   * @optional
   * @default false
   */
  verified?: boolean | false
  /**
   * @filters json, encrypt
   * @optional
   */
  data?: Record<string, unknown>
}

export interface Challenges extends IEntity {
  /** @optional */
  userInternalId?: number
  /** @optional */
  userId?: string
  /** @optional */
  type?: string
  /**
   * @filter encrypt
   * @optional
   */
  token?: string
  /**
   * @filter encrypt
   * @optional
   */
  code?: string
  /** @optional */
  expire?: Date
}

export interface Identities extends IEntity {
  /** @optional */
  userInternalId?: number
  /** @optional */
  userId?: string
  /** @optional */
  provider?: string
  /** @optional */
  providerUid?: string
  /** @optional */
  providerEmail?: string
  /**
   * @filter encrypt
   * @optional
   */
  providerAccessToken?: string
  /** @optional */
  providerAccessTokenExpiry?: Date
  /**
   * @filter encrypt
   * @optional
   */
  providerRefreshToken?: string
  /**
   * @filters json, encrypt
   * @optional
   */
  secrets?: Record<string, unknown>
}

export interface Targets extends IEntity {
  /** @required */
  userId: string
  /** @required */
  userInternalId: number
  /** @optional */
  sessionId?: string
  /** @optional */
  sessionInternalId?: number
  /** @required */
  providerType: string
  /** @optional */
  providerId?: string
  /** @optional */
  providerInternalId?: number
  /** @required */
  identifier: string
  /** @optional */
  name?: string
  /**
   * @optional
   * @default false
   */
  expired?: boolean | false
}

export interface Teams extends IEntity {
  /** @required */
  name: string
  /**
   * @optional
   * @default 0
   */
  total?: number | 0
  /**
   * @filter json
   * @optional
   * @default {}
   */
  prefs?: Record<string, unknown>
  /**
   * @filter subQueryMemberships
   * @optional
   */
  memberships?: Memberships[]
  /** @optional */
  search?: string
}

export interface Memberships extends IEntity {
  /** @required */
  userInternalId: number
  /** @optional */
  userId?: string
  /** @required */
  teamInternalId: number
  /** @optional */
  teamId?: string
  /**
   * @array
   * @optional
   * @default []
   */
  roles?: string[]
  /** @optional */
  invited?: Date
  /** @optional */
  joined?: Date
  /** @optional */
  confirm?: boolean
  /**
   * @filter encrypt
   * @optional
   */
  secret?: string
  /** @optional */
  search?: string
}

export interface Buckets extends IEntity {
  /** @required */
  enabled: boolean
  /** @required */
  name: string
  /** @optional */
  fileSecurity?: boolean
  /** @required */
  maximumFileSize: number
  /**
   * @array
   * @required
   */
  allowedFileExtensions: string[]
  /** @required */
  compression: string
  /** @required */
  encryption: boolean
  /** @required */
  antivirus: boolean
  /**
   * @filter subQueryFiles
   * @optional
   */
  files?: Files[]
  /** @optional */
  search?: string
}

export interface Files extends IEntity {
  /** @optional */
  bucketId?: string
  /** @required */
  bucketInternalId: number
  /** @optional */
  name?: string
  /** @optional */
  path?: string
  /** @optional */
  signature?: string
  /** @optional */
  mimeType?: string
  /** @required */
  sizeOriginal: number
  /** @optional */
  chunksTotal?: number
  /** @optional */
  chunksUploaded?: number
}

export interface Stats extends IEntity {
  /** @required */
  metric: string
  /** @required */
  region: string
  /** @required */
  value: number
  /** @optional */
  time?: Date
  /** @required */
  period: string
}

export interface Providers extends IEntity {
  /** @required */
  name: string
  /** @required */
  provider: string
  /** @required */
  type: string
  /**
   * @required
   * @default true
   */
  enabled: boolean
  /**
   * @filters json, encrypt
   * @required
   */
  credentials: Record<string, unknown>
  /**
   * @filter json
   * @optional
   */
  options?: Record<string, unknown>
  /**
   * @filter providerSearch
   * @optional
   */
  search?: string
}

export interface Messages extends IEntity {
  /** @required */
  providerType: string
  /**
   * @required
   * @default "processing"
   */
  status: string
  /**
   * @filter json
   * @required
   */
  data: Record<string, unknown>
  /**
   * @array
   * @optional
   */
  topics?: string[]
  /**
   * @array
   * @optional
   */
  users?: string[]
  /**
   * @array
   * @optional
   */
  targets?: string[]
  /** @optional */
  scheduledAt?: Date
  /** @optional */
  scheduleInternalId?: number
  /** @optional */
  scheduleId?: string
  /** @optional */
  deliveredAt?: Date
  /**
   * @array
   * @optional
   */
  deliveryErrors?: string[]
  /**
   * @optional
   * @default 0
   */
  deliveredTotal?: number | 0
  /**
   * @filter messageSearch
   * @optional
   */
  search?: string
}

export interface Topics extends IEntity {
  /** @required */
  name: string
  /** @optional */
  description?: string
  /**
   * @array
   * @optional
   */
  subscribe?: string[]
  /**
   * @optional
   * @default 0
   */
  emailTotal?: number | 0
  /**
   * @optional
   * @default 0
   */
  smsTotal?: number | 0
  /**
   * @optional
   * @default 0
   */
  pushTotal?: number | 0
  /**
   * @filter subQueryTopicTargets
   * @optional
   */
  targets?: Targets[]
  /**
   * @filter topicSearch
   * @optional
   */
  search?: string
}

export interface Subscribers extends IEntity {
  /** @required */
  targetId: string
  /** @required */
  targetInternalId: number
  /** @required */
  userId: string
  /** @required */
  userInternalId: number
  /** @required */
  topicId: string
  /** @required */
  topicInternalId: number
  /** @required */
  providerType: string
  /** @optional */
  search?: string
}

// Document Types
export type UsersDoc = Doc<Users>
export type SessionsDoc = Doc<Sessions>
export type TokensDoc = Doc<Tokens>
export type AuthenticatorsDoc = Doc<Authenticators>
export type ChallengesDoc = Doc<Challenges>
export type IdentitiesDoc = Doc<Identities>
export type TargetsDoc = Doc<Targets>
export type TeamsDoc = Doc<Teams>
export type MembershipsDoc = Doc<Memberships>
export type BucketsDoc = Doc<Buckets>
export type FilesDoc = Doc<Files>
export type StatsDoc = Doc<Stats>
export type ProvidersDoc = Doc<Providers>
export type MessagesDoc = Doc<Messages>
export type TopicsDoc = Doc<Topics>
export type SubscribersDoc = Doc<Subscribers>

// Utility Types

// Utility types for Users
export type UsersCreate = Omit<
  Users,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type UsersUpdate = Partial<UsersCreate>
export type UsersKeys = keyof Users
export type UsersValues = Users[UsersKeys]

// Utility types for Sessions
export type SessionsCreate = Omit<
  Sessions,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type SessionsUpdate = Partial<SessionsCreate>
export type SessionsKeys = keyof Sessions
export type SessionsValues = Sessions[SessionsKeys]

// Utility types for Tokens
export type TokensCreate = Omit<
  Tokens,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type TokensUpdate = Partial<TokensCreate>
export type TokensKeys = keyof Tokens
export type TokensValues = Tokens[TokensKeys]

// Utility types for Authenticators
export type AuthenticatorsCreate = Omit<
  Authenticators,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type AuthenticatorsUpdate = Partial<AuthenticatorsCreate>
export type AuthenticatorsKeys = keyof Authenticators
export type AuthenticatorsValues = Authenticators[AuthenticatorsKeys]

// Utility types for Challenges
export type ChallengesCreate = Omit<
  Challenges,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type ChallengesUpdate = Partial<ChallengesCreate>
export type ChallengesKeys = keyof Challenges
export type ChallengesValues = Challenges[ChallengesKeys]

// Utility types for Identities
export type IdentitiesCreate = Omit<
  Identities,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type IdentitiesUpdate = Partial<IdentitiesCreate>
export type IdentitiesKeys = keyof Identities
export type IdentitiesValues = Identities[IdentitiesKeys]

// Utility types for Targets
export type TargetsCreate = Omit<
  Targets,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type TargetsUpdate = Partial<TargetsCreate>
export type TargetsKeys = keyof Targets
export type TargetsValues = Targets[TargetsKeys]

// Utility types for Teams
export type TeamsCreate = Omit<
  Teams,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type TeamsUpdate = Partial<TeamsCreate>
export type TeamsKeys = keyof Teams
export type TeamsValues = Teams[TeamsKeys]

// Utility types for Memberships
export type MembershipsCreate = Omit<
  Memberships,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type MembershipsUpdate = Partial<MembershipsCreate>
export type MembershipsKeys = keyof Memberships
export type MembershipsValues = Memberships[MembershipsKeys]

// Utility types for Buckets
export type BucketsCreate = Omit<
  Buckets,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type BucketsUpdate = Partial<BucketsCreate>
export type BucketsKeys = keyof Buckets
export type BucketsValues = Buckets[BucketsKeys]

// Utility types for Files
export type FilesCreate = Omit<
  Files,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type FilesUpdate = Partial<FilesCreate>
export type FilesKeys = keyof Files
export type FilesValues = Files[FilesKeys]

// Utility types for Stats
export type StatsCreate = Omit<
  Stats,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type StatsUpdate = Partial<StatsCreate>
export type StatsKeys = keyof Stats
export type StatsValues = Stats[StatsKeys]

// Utility types for Providers
export type ProvidersCreate = Omit<
  Providers,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type ProvidersUpdate = Partial<ProvidersCreate>
export type ProvidersKeys = keyof Providers
export type ProvidersValues = Providers[ProvidersKeys]

// Utility types for Messages
export type MessagesCreate = Omit<
  Messages,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type MessagesUpdate = Partial<MessagesCreate>
export type MessagesKeys = keyof Messages
export type MessagesValues = Messages[MessagesKeys]

// Utility types for Topics
export type TopicsCreate = Omit<
  Topics,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type TopicsUpdate = Partial<TopicsCreate>
export type TopicsKeys = keyof Topics
export type TopicsValues = Topics[TopicsKeys]

// Utility types for Subscribers
export type SubscribersCreate = Omit<
  Subscribers,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type SubscribersUpdate = Partial<SubscribersCreate>
export type SubscribersKeys = keyof Subscribers
export type SubscribersValues = Subscribers[SubscribersKeys]

// Input Types

// Input types for Users
export type UsersInput = UsersCreate
export type UsersCreateInput = UsersCreate
export type UsersUpdateInput = UsersUpdate

// Input types for Sessions
export type SessionsInput = SessionsCreate
export type SessionsCreateInput = SessionsCreate
export type SessionsUpdateInput = SessionsUpdate

// Input types for Tokens
export type TokensInput = TokensCreate
export type TokensCreateInput = TokensCreate
export type TokensUpdateInput = TokensUpdate

// Input types for Authenticators
export type AuthenticatorsInput = AuthenticatorsCreate
export type AuthenticatorsCreateInput = AuthenticatorsCreate
export type AuthenticatorsUpdateInput = AuthenticatorsUpdate

// Input types for Challenges
export type ChallengesInput = ChallengesCreate
export type ChallengesCreateInput = ChallengesCreate
export type ChallengesUpdateInput = ChallengesUpdate

// Input types for Identities
export type IdentitiesInput = IdentitiesCreate
export type IdentitiesCreateInput = IdentitiesCreate
export type IdentitiesUpdateInput = IdentitiesUpdate

// Input types for Targets
export type TargetsInput = TargetsCreate
export type TargetsCreateInput = TargetsCreate
export type TargetsUpdateInput = TargetsUpdate

// Input types for Teams
export type TeamsInput = TeamsCreate
export type TeamsCreateInput = TeamsCreate
export type TeamsUpdateInput = TeamsUpdate

// Input types for Memberships
export type MembershipsInput = MembershipsCreate
export type MembershipsCreateInput = MembershipsCreate
export type MembershipsUpdateInput = MembershipsUpdate

// Input types for Buckets
export type BucketsInput = BucketsCreate
export type BucketsCreateInput = BucketsCreate
export type BucketsUpdateInput = BucketsUpdate

// Input types for Files
export type FilesInput = FilesCreate
export type FilesCreateInput = FilesCreate
export type FilesUpdateInput = FilesUpdate

// Input types for Stats
export type StatsInput = StatsCreate
export type StatsCreateInput = StatsCreate
export type StatsUpdateInput = StatsUpdate

// Input types for Providers
export type ProvidersInput = ProvidersCreate
export type ProvidersCreateInput = ProvidersCreate
export type ProvidersUpdateInput = ProvidersUpdate

// Input types for Messages
export type MessagesInput = MessagesCreate
export type MessagesCreateInput = MessagesCreate
export type MessagesUpdateInput = MessagesUpdate

// Input types for Topics
export type TopicsInput = TopicsCreate
export type TopicsCreateInput = TopicsCreate
export type TopicsUpdateInput = TopicsUpdate

// Input types for Subscribers
export type SubscribersInput = SubscribersCreate
export type SubscribersCreateInput = SubscribersCreate
export type SubscribersUpdateInput = SubscribersUpdate

export interface Entities {
  users: Users
  sessions: Sessions
  tokens: Tokens
  authenticators: Authenticators
  challenges: Challenges
  identities: Identities
  targets: Targets
  teams: Teams
  memberships: Memberships
  buckets: Buckets
  files: Files
  stats: Stats
  providers: Providers
  messages: Messages
  topics: Topics
  subscribers: Subscribers
}

type GeneratedEntitiesRegistry = Entities

/**
 * Opt-in integration: including or importing this generated file augments
 * the package registry. Session APIs then infer collection IDs, documents,
 * and query attributes while their arbitrary-string fallback remains intact.
 */
declare module '@nuvix/db' {
  interface Entities extends GeneratedEntitiesRegistry {}
}
