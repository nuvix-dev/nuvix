// This file is auto-generated. Do not edit manually.
// Generated on: 2026-09-24T03:01:58.102Z

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

// Document Types
export type ProjectsDoc = Doc<Projects>

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

// Input Types

// Input types for Projects
export type ProjectsInput = ProjectsCreate
export type ProjectsCreateInput = ProjectsCreate
export type ProjectsUpdateInput = ProjectsUpdate

export interface Entities {
  projects: Projects
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
