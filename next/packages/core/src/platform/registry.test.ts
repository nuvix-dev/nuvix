import { beforeAll, describe, expect, test } from 'bun:test'
import { type Database, Doc } from '@nuvix/db'
import type { TenantTarget } from '../tenants'
import { createPlatformDatabase } from './database'
import { ProjectRegistry } from './registry'

const encryptionKey = '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='
const target: TenantTarget = {
  host: '127.0.0.1',
  port: 5432,
  database: 'nuvix',
  user: 'nuvix_admin',
  password: 'secret',
}

let db: Database
let registry: ProjectRegistry

beforeAll(async () => {
  db = await createPlatformDatabase({
    driver: 'sqlite',
    url: ':memory:',
    encryptionKey,
  })
  registry = new ProjectRegistry(db)
})

describe('ProjectRegistry', () => {
  test('resolves an active project by publishable key and decrypts its target', async () => {
    await db.system().createDocument(
      'projects',
      new Doc({
        $id: 'active-project',
        $permissions: [],
        name: 'Active',
        status: 'active',
        publishableKey: 'pk_active',
        containerName: 'tenant-active',
        volumeName: 'tenant-active-data',
        target,
      }),
    )

    expect(await registry.resolve('pk_active')).toEqual({
      id: 'active-project',
      target,
    })
  })

  test('does not resolve unknown or inactive projects', async () => {
    await db.system().createDocument(
      'projects',
      new Doc({
        $id: 'provisioning-project',
        $permissions: [],
        name: 'Provisioning',
        status: 'provisioning',
        publishableKey: 'pk_provisioning',
        containerName: 'tenant-provisioning',
        volumeName: 'tenant-provisioning-data',
      }),
    )

    expect(await registry.resolve('pk_missing')).toBeNull()
    expect(await registry.resolve('pk_provisioning')).toBeNull()
  })
})
