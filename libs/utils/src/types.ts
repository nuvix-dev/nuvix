import type { configuration } from './configuration.js'
import { UsersDoc } from '../types/'
import { SchemaType } from './constants.js'

export type Configuration = typeof configuration

export type DatabaseConfig = {
  postgres: {
    host: string
    port: number
    database: string
    password: string
    // ssl
  }
  pool: {
    host: string
    port: number
    database: string
    password: string
  }
}

export type Schema = {
  id: number
  name: string
  type: SchemaType
  enabled: boolean
  metadata: Record<string, any>
}

type KeyArgs = {
  ip: string
  params: Record<string, any>
  body: Record<string, any>
  user: UsersDoc
  req: NuvixRequest
}

export type ThrottleOptions = {
  limit: number
  ttl?: number // time to live in seconds
  key?: string | ((args: KeyArgs) => string | string[])
  /**
   * Get the throttle config from project configuration, if not set then use the default limit and ttl
   */
  configKey?: string
}

export type IResponse<T, E = unknown> = T & E

export type IListResponse<T, E = unknown> = {
  data: T[]
  total: number
} & E
