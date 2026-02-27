import { UsersDoc } from '../types/'
import { nxconfig } from './configuration.js'
import { SchemaType } from './constants.js'

export type Configuration = ReturnType<typeof nxconfig>

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
  description?: string
}

export type KeyArgs = {
  ip: string
  params: Record<string, any>
  body: Record<string, any>
  user: UsersDoc
  req: NuvixRequest
}

type V = 'url' | 'ip' | 'userId' | 'method' | `body-${string}`

type Segment = `${string}:{${V}}`

type One = Segment
type Two = `${One},${One}`
type Three = `${Two},${One}`
type Four = `${Three},${One}`
type Key = One | Two | Three | Four

export type ThrottleOptions = {
  limit: number
  ttl?: number // time to live in seconds
  key?: Key | Key[] | ((args: KeyArgs) => string | string[])
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
