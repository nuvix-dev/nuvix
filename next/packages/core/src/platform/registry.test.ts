import { beforeAll, describe, expect, test } from 'bun:test'
import { type Database, Doc } from '@nuvix/db'
import type { TenantTarget } from '../tenants'
import { createPlatformDatabase } from './database'
import { KeyRegistry, ProjectRegistry } from './registry'

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
let keyRegistry: KeyRegistry

beforeAll(async () => {
  db = await createPlatformDatabase({
    driver: 'sqlite',
    url: ':memory:',
    encryptionKey,
  })
  registry = new ProjectRegistry(db)
  keyRegistry = new KeyRegistry(db)
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

describe('KeyRegistry', () => {
  test('resolves a valid API key for a project', async () => {
    await db.system().createDocument(
      'keys',
      new Doc({
        $id: 'key-1',
        $permissions: [],
        projectInternalId: 1,
        projectId: 'active-project',
        name: 'Standard Key',
        scopes: ['users.read', 'users.write'],
        secret: 'standard_secret_abc123',
        expire: null,
      }),
    )

    const resolved = await keyRegistry.resolve('active-project', 'standard_secret_abc123')
    expect(resolved).toEqual({
      id: 'key-1',
      projectId: 'active-project',
      name: 'Standard Key',
      scopes: ['users.read', 'users.write'],
      expire: null,
    })
  })

  test('does not resolve an unknown key or wrong project', async () => {
    expect(await keyRegistry.resolve('active-project', 'unknown_secret')).toBeNull()
    expect(await keyRegistry.resolve('other-project', 'standard_secret_abc123')).toBeNull()
  })

  test('does not resolve an expired key', async () => {
    await db.system().createDocument(
      'keys',
      new Doc({
        $id: 'expired-key',
        $permissions: [],
        projectInternalId: 1,
        projectId: 'active-project',
        name: 'Expired Key',
        scopes: ['users.read'],
        secret: 'standard_secret_expired',
        expire: new Date(Date.now() - 60_000).toISOString(),
      }),
    )

    expect(await keyRegistry.resolve('active-project', 'standard_secret_expired')).toBeNull()
  })
})
