// This file is auto-generated. Do not edit manually.
// Generated on: 2026-09-24T11:41:28.411Z

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
  /**
   * @filter encrypt
   * @required
   */
  secret: string
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

// Document Types
export type ProjectsDoc = Doc<Projects>
export type WebhooksDoc = Doc<Webhooks>
export type KeysDoc = Doc<Keys>

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

// Input Types

// Input types for Projects
export type ProjectsInput = ProjectsCreate
export type ProjectsCreateInput = ProjectsCreate
export type ProjectsUpdateInput = ProjectsUpdate

// Input types for Webhooks
export type WebhooksInput = WebhooksCreate
export type WebhooksCreateInput = WebhooksCreate
export type WebhooksUpdateInput = WebhooksUpdate

// Input types for Keys
export type KeysInput = KeysCreate
export type KeysCreateInput = KeysCreate
export type KeysUpdateInput = KeysUpdate

export interface Entities {
  projects: Projects
  webhooks: Webhooks
  keys: Keys
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
