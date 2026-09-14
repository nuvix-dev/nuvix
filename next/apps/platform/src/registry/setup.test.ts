process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { describe, expect, test } from 'bun:test'
import { createPlatformDatabase, ensurePlatformSchema } from './setup'

describe('createPlatformDatabase', () => {
  test('bootstraps the projects collection on a fresh sqlite database', async () => {
    const db = await createPlatformDatabase()
    expect(await db.exists(undefined, 'projects')).toBe(true)
  })

  test('ensurePlatformSchema is idempotent on an already-bootstrapped database', async () => {
    const db = await createPlatformDatabase()
    await ensurePlatformSchema(db)
    await ensurePlatformSchema(db)
    expect(await db.exists(undefined, 'projects')).toBe(true)
  })
})
