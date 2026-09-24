/**
 * Typed environment configuration for Nuvix v2.
 *
 * `@nuvix/utils` is shared by every app in the monorepo (server, platform,
 * future ones), and each app only needs a subset of these variables. Every
 * field below is a lazy getter — `Bun.env` is read and validated the first
 * time a field is actually accessed, not when this module is imported. This
 * still fails fast (the first line of app code that needs
 * `NUVIX_TENANT_ENCRYPTION_KEY` throws immediately if it's missing) without
 * forcing an app that never touches tenant provisioning to also supply it,
 * and vice versa.
 */

export type NuvixEnv = 'development' | 'production' | 'test'

function required(name: string, fallback?: string): string {
  const value = Bun.env[name] ?? fallback
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}. See docs/ENV.md.`)
  }
  return value
}

function parsePort(name: string, raw: string): number {
  const port = Number.parseInt(raw, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer in [1, 65535], got: ${raw}`)
  }
  return port
}

function readEnv(): NuvixEnv {
  const value = required('NUVIX_ENV', 'development')
  if (value !== 'development' && value !== 'production' && value !== 'test') {
    throw new Error(`NUVIX_ENV must be development | production | test, got: ${value}`)
  }
  return value
}

export const config = {
  /** `development` | `production` | `test` */
  get env(): NuvixEnv {
    return readEnv()
  },
  get isProd(): boolean {
    return readEnv() === 'production'
  },
  get isDev(): boolean {
    return readEnv() === 'development'
  },
  get isTest(): boolean {
    return readEnv() === 'test'
  },

  get host(): string {
    return required('NUVIX_HOST', '0.0.0.0')
  },
  get port(): number {
    return parsePort('NUVIX_PORT', required('NUVIX_PORT', '4000'))
  },

  /** PostgreSQL connection string for internal/platform tables. */
  get internalDatabaseUrl(): string {
    return required('NUVIX_INTERNAL_DATABASE_URL')
  },

  /** Redis connection string (queues/cache). */
  get redisUrl(): string {
    return required('NUVIX_REDIS_URL')
  },

  /** Secret used to sign JWTs / tokens. */
  get jwtSecret(): string {
    return required('NUVIX_JWT_SECRET')
  },

  storage: {
    get uploadsDir(): string {
      return Bun.env.NUVIX_STORAGE_UPLOADS ?? './storage/uploads'
    },
  },

  platform: {
    get host(): string {
      return required('NUVIX_PLATFORM_HOST', '0.0.0.0')
    },
    get port(): number {
      return parsePort('NUVIX_PLATFORM_PORT', required('NUVIX_PLATFORM_PORT', '4100'))
    },

    /** `sqlite` (default — zero-infra local dev) or `postgres`. */
    get dbDriver(): PlatformDbDriver {
      return parsePlatformDbDriver(Bun.env.NUVIX_PLATFORM_DB_DRIVER ?? 'sqlite')
    },
    /** SQLite file path, or a PostgreSQL connection string when `dbDriver` is `postgres`. */
    get dbUrl(): string {
      return Bun.env.NUVIX_PLATFORM_DB_URL ?? './data/platform.sqlite'
    },

    /** Base64-encoded 32-byte AES-256-GCM key encrypting tenant targets at rest (D37). */
    get tenantEncryptionKey(): string {
      return required('NUVIX_TENANT_ENCRYPTION_KEY')
    },
    /** Tenant image pin (D24) — override only for local dev without the exact tag. */
    get tenantPostgresImage(): string {
      return Bun.env.NUVIX_TENANT_POSTGRES_IMAGE ?? 'nuvix/postgres:18.1'
    },
  },
}

export type PlatformDbDriver = 'sqlite' | 'postgres'

function parsePlatformDbDriver(raw: string): PlatformDbDriver {
  if (raw !== 'sqlite' && raw !== 'postgres') {
    throw new Error(`NUVIX_PLATFORM_DB_DRIVER must be sqlite | postgres, got: ${raw}`)
  }
  return raw
}

export type Config = typeof config
