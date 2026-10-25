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

import path from 'node:path'

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

  /**
   * Cookie settings for browser-facing flows (OAuth2 sessions, magic URL).
   * Legacy names: NUVIX_COOKIE_DOMAIN / NUVIX_COOKIE_SAMESITE /
   * NUVIX_COOKIE_NAME / NUVIX_CONSOLE_URL.
   */
  get consoleURL(): string {
    return Bun.env.NUVIX_CONSOLE_URL ?? 'http://localhost:3000'
  },
  cookie: {
    get domain(): string | undefined {
      return Bun.env.NUVIX_COOKIE_DOMAIN || undefined
    },
    /** 'lax' | 'none' | 'strict' — legacy defaulted to 'none'. */
    get sameSite(): 'lax' | 'none' | 'strict' {
      const raw = (Bun.env.NUVIX_COOKIE_SAMESITE ?? 'none').toLowerCase()
      return raw === 'lax' || raw === 'strict' ? raw : 'none'
    },
    get name(): string {
      return Bun.env.NUVIX_COOKIE_NAME ?? 'session'
    },
    /** Legacy `NUVIX_DEBUG_FALLBACK_COOKIES` — X-Fallback-Cookies header. */
    get fallback(): boolean {
      return (Bun.env.NUVIX_DEBUG_FALLBACK_COOKIES ?? '').toLowerCase() === 'true'
    },
  },

  /**
   * Global SMTP settings for system emails (verification, recovery,
   * magic URL, OTP, MFA challenges). All optional — mail sending is
   * enabled when `host` is set (legacy `configuration.smtp.enabled()`
   * semantics). Projects override via their own `smtp` record.
   */
  smtp: {
    get host(): string {
      return Bun.env.NUVIX_SMTP_HOST ?? ''
    },
    get port(): number {
      const raw = Number.parseInt(Bun.env.NUVIX_SMTP_PORT ?? '587', 10)
      return Number.isInteger(raw) && raw > 0 ? raw : 587
    },
    get user(): string {
      return Bun.env.NUVIX_SMTP_USER ?? ''
    },
    get password(): string {
      return Bun.env.NUVIX_SMTP_PASSWORD ?? ''
    },
    get secure(): boolean {
      return (Bun.env.NUVIX_SMTP_SECURE ?? '').toLowerCase() === 'true'
    },
    /** System sender address (fallback when the project has none). */
    get emailFrom(): string {
      return Bun.env.NUVIX_SMTP_EMAIL_FROM ?? ''
    },
    /** System sender display name (fallback when the project has none). */
    get sender(): string {
      return Bun.env.NUVIX_SMTP_SENDER ?? 'Nuvix'
    },
    get replyTo(): string {
      return Bun.env.NUVIX_SMTP_REPLY_TO ?? ''
    },
    /** Mail sending is enabled when an SMTP host is configured. */
    get enabled(): boolean {
      return Boolean(Bun.env.NUVIX_SMTP_HOST)
    },
  },

  /** Usage-metrics recording (network + document events) — v1 enableStats. */
  stats: {
    /** Opt-out via `NUVIX_ENABLE_STATS=false`. */
    get enabled(): boolean {
      return Bun.env.NUVIX_ENABLE_STATS !== 'false'
    },
  },

  limits: {
    /** Max users per project — legacy `NUVIX_LIMIT_USERS` (0 = unlimited). */
    get users(): number {
      const raw = Number.parseInt(Bun.env.NUVIX_LIMIT_USERS ?? '10000', 10)
      return Number.isFinite(raw) && raw >= 0 ? raw : 10000
    },
  },

  storage: {
    get uploadsDir(): string {
      const raw = Bun.env.NUVIX_STORAGE_UPLOADS ?? './storage/uploads'
      return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw)
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
