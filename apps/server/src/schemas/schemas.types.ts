import type { DataSource } from '@nuvix/pg'
import { ProjectsDoc } from '@nuvix/utils/types'

export interface Select {
  schema: string
  pg: DataSource
  table: string
  url: string
  limit?: number
  offset?: number
  shape?: 'array' | 'object'
  project: ProjectsDoc
  context?: Record<string, any>
}

export interface Insert {
  pg: DataSource
  table: string
  input:
    | Record<string, string | number | null | boolean>
    | Record<string, string | number | null | boolean>[]
  columns?: string[]
  schema: string
  url: string
  returnPref?: 'minimal' | 'location' | 'full'
  project: ProjectsDoc
}

export interface Update extends Omit<Insert, 'input'> {
  input: Record<string, string | number | null | boolean>
  limit?: number
  offset?: number
  force?: boolean
}

export interface Delete extends Select {
  force?: boolean
}

export interface CallFunction {
  schema: string
  pg: DataSource
  functionName: string
  url: string
  limit?: number
  offset?: number
  args?: Record<string, string | number | boolean | null> | any[]
  project: ProjectsDoc
}

export interface UpdatePermissions {
  pg: DataSource
  schema: string
  permissions: string[]
  rowId?: number
  tableId: string
  project: ProjectsDoc
}

export interface GetPermissions {
  pg: DataSource
  schema: string
  rowId?: number
  tableId: string
  project: ProjectsDoc
}
