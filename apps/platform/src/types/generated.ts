// This file is auto-generated. Do not edit manually.
// Generated on: 2026-11-14T14:59:39.340Z

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

export interface Projects extends IEntity {
  /** @required */
  name: string
  /**
   * @required
   * @default "provisioning"
   */
  status: string
  /** @required */
  publishableKey: string
  /** @required */
  containerName: string
  /** @required */
  volumeName: string
  /**
   * @filters json, encrypt
   * @optional
   */
  target?: string
  /** @optional */
  errorMessage?: string
  /**
   * @optional
   * @default {}
   */
  auths?: Record<string, unknown>
  /** @optional */
  description?: string
  /**
   * @optional
   * @default {}
   */
  services?: Record<string, unknown>
  /**
   * @optional
   * @default {}
   */
  apis?: Record<string, unknown>
  /**
   * @optional
   * @default {}
   */
  oAuthProviders?: Record<string, unknown>
  /**
   * @optional
   * @default {}
   */
  smtp?: Record<string, unknown>
  /**
   * @optional
   * @default {}
   */
  metadata?: Record<string, unknown>
  /** @optional */
  logo?: string
  /** @optional */
  url?: string
  /**
   * @optional
   * @default {}
   */
  templates?: Record<string, unknown>
}

export interface Webhooks extends IEntity {
  /** @required */
  projectInternalId: number
  /** @required */
  projectId: string
  /** @required */
  name: string
  /** @required */
  url: string
  /** @optional */
  httpUser?: string
  /**
   * @filter encrypt
   * @optional
   */
  httpPass?: string
  /**
   * @required
   * @default true
   */
  security: boolean
  /**
   * @array
   * @required
   */
  events: string[]
  /** @optional */
  signatureKey?: string
  /**
   * @required
   * @default true
   */
  enabled: boolean
  /**
   * @optional
   * @default ""
   */
  logs?: string | ''
  /**
   * @optional
   * @default 0
   */
  attempts?: number | 0
}

export interface WebhookLogs extends IEntity {
  /** @required */
  webhookInternalId: number
  /** @required */
  timestamp: Date
  /** @required */
  success: boolean
  /** @optional */
  statusCode?: number
  /** @optional */
  response?: string
  /** @optional */
  error?: string
}

export interface Keys extends IEntity {
  /** @required */
  projectInternalId: number
  /** @required */
  projectId: string
  /** @required */
  name: string
  /**
   * @array
   * @required
   */
  scopes: string[]
  /** @required */
  secretHash: string
  /** @optional */
  expire?: Date
  /** @optional */
  accessedAt?: Date
  /**
   * @array
   * @optional
   * @default []
   */
  sdks?: string[]
}

export interface Platforms extends IEntity {
  /** @required */
  projectInternalId: number
  /** @required */
  projectId: string
  /** @required */
  type: string
  /** @required */
  name: string
  /** @optional */
  key?: string
  /** @optional */
  store?: string
  /** @optional */
  hostname?: string
}

export interface ConsoleUsers extends IEntity {
  /** @required */
  email: string
  /** @optional */
  name?: string
  /** @required */
  passwordHash: string
}

export interface ConsoleSessions extends IEntity {
  /** @required */
  userId: string
  /** @required */
  refreshHash: string
  /** @optional */
  previousHash?: string
  /** @optional */
  userAgent?: string
  /** @required */
  expireAt: Date
}

// Document Types
export type ProjectsDoc = Doc<Projects>
export type WebhooksDoc = Doc<Webhooks>
export type WebhookLogsDoc = Doc<WebhookLogs>
export type KeysDoc = Doc<Keys>
export type PlatformsDoc = Doc<Platforms>
export type ConsoleUsersDoc = Doc<ConsoleUsers>
export type ConsoleSessionsDoc = Doc<ConsoleSessions>

// Utility Types

// Utility types for Projects
export type ProjectsCreate = Omit<
  Projects,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type ProjectsUpdate = Partial<ProjectsCreate>
export type ProjectsKeys = keyof Projects
export type ProjectsValues = Projects[ProjectsKeys]

// Utility types for Webhooks
export type WebhooksCreate = Omit<
  Webhooks,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type WebhooksUpdate = Partial<WebhooksCreate>
export type WebhooksKeys = keyof Webhooks
export type WebhooksValues = Webhooks[WebhooksKeys]

// Utility types for WebhookLogs
export type WebhookLogsCreate = Omit<
  WebhookLogs,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type WebhookLogsUpdate = Partial<WebhookLogsCreate>
export type WebhookLogsKeys = keyof WebhookLogs
export type WebhookLogsValues = WebhookLogs[WebhookLogsKeys]

// Utility types for Keys
export type KeysCreate = Omit<
  Keys,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type KeysUpdate = Partial<KeysCreate>
export type KeysKeys = keyof Keys
export type KeysValues = Keys[KeysKeys]

// Utility types for Platforms
export type PlatformsCreate = Omit<
  Platforms,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type PlatformsUpdate = Partial<PlatformsCreate>
export type PlatformsKeys = keyof Platforms
export type PlatformsValues = Platforms[PlatformsKeys]

// Utility types for ConsoleUsers
export type ConsoleUsersCreate = Omit<
  ConsoleUsers,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type ConsoleUsersUpdate = Partial<ConsoleUsersCreate>
export type ConsoleUsersKeys = keyof ConsoleUsers
export type ConsoleUsersValues = ConsoleUsers[ConsoleUsersKeys]

// Utility types for ConsoleSessions
export type ConsoleSessionsCreate = Omit<
  ConsoleSessions,
  | '$id'
  | '$createdAt'
  | '$updatedAt'
  | '$permissions'
  | '$sequence'
  | '$collection'
  | '$tenant'
  | '$schema'
>
export type ConsoleSessionsUpdate = Partial<ConsoleSessionsCreate>
export type ConsoleSessionsKeys = keyof ConsoleSessions
export type ConsoleSessionsValues = ConsoleSessions[ConsoleSessionsKeys]

// Input Types

// Input types for Projects
export type ProjectsInput = ProjectsCreate
export type ProjectsCreateInput = ProjectsCreate
export type ProjectsUpdateInput = ProjectsUpdate

// Input types for Webhooks
export type WebhooksInput = WebhooksCreate
export type WebhooksCreateInput = WebhooksCreate
export type WebhooksUpdateInput = WebhooksUpdate

// Input types for WebhookLogs
export type WebhookLogsInput = WebhookLogsCreate
export type WebhookLogsCreateInput = WebhookLogsCreate
export type WebhookLogsUpdateInput = WebhookLogsUpdate

// Input types for Keys
export type KeysInput = KeysCreate
export type KeysCreateInput = KeysCreate
export type KeysUpdateInput = KeysUpdate

// Input types for Platforms
export type PlatformsInput = PlatformsCreate
export type PlatformsCreateInput = PlatformsCreate
export type PlatformsUpdateInput = PlatformsUpdate

// Input types for ConsoleUsers
export type ConsoleUsersInput = ConsoleUsersCreate
export type ConsoleUsersCreateInput = ConsoleUsersCreate
export type ConsoleUsersUpdateInput = ConsoleUsersUpdate

// Input types for ConsoleSessions
export type ConsoleSessionsInput = ConsoleSessionsCreate
export type ConsoleSessionsCreateInput = ConsoleSessionsCreate
export type ConsoleSessionsUpdateInput = ConsoleSessionsUpdate

export interface Entities {
  projects: Projects
  webhooks: Webhooks
  webhook_logs: WebhookLogs
  keys: Keys
  platforms: Platforms
  console_users: ConsoleUsers
  console_sessions: ConsoleSessions
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
