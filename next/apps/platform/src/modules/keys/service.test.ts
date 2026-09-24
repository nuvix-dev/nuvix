process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { beforeAll, describe, expect, test } from 'bun:test'
import { FakeTenantProvisioner } from '@nuvix/core/tenants'
import type { Database } from '@nuvix/db'
import { createPlatformDatabase } from '../../registry/setup'
import { ProjectService } from '../projects/service'
import { KeysService } from './service'

let db: Database
let projectService: ProjectService
let keysService: KeysService
let projectId: string

const noopBootstrap = async () => {}

beforeAll(async () => {
  db = await createPlatformDatabase()
  projectService = new ProjectService(db, new FakeTenantProvisioner(), noopBootstrap)
  keysService = new KeysService(db)

  const project = await projectService.create({ name: 'Keys Test Project' })
  projectId = project.$id
})

describe('KeysService', () => {
  test('creates an API key for a project', async () => {
    const key = await keysService.create(projectId, {
      name: 'Server Key',
      scopes: ['users.read', 'users.write', 'storage.read'],
      expire: '2030-01-01T00:00:00.000Z',
    })

    expect(key.projectId).toBe(projectId)
    expect(key.name).toBe('Server Key')
    expect(key.scopes).toEqual(['users.read', 'users.write', 'storage.read'])
    expect(key.secret).toMatch(/^standard_[0-9a-f]{256}$/)
    expect(key.expire).toBeDefined()
  })

  test('lists keys for a project', async () => {
    const { keys, total } = await keysService.list(projectId)
    expect(total).toBeGreaterThanOrEqual(1)
    expect(keys.length).toBeGreaterThanOrEqual(1)
  })

  test('gets a key by id', async () => {
    const created = await keysService.create(projectId, {
      name: 'To Get Key',
      scopes: ['files.read'],
    })

    const fetched = await keysService.get(projectId, created.$id)
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.name).toBe('To Get Key')
    expect(fetched.secret).toBe(created.secret)
  })

  test('updates a key', async () => {
    const created = await keysService.create(projectId, {
      name: 'Initial Key Name',
      scopes: ['users.read'],
    })

    const updated = await keysService.update(projectId, created.$id, {
      name: 'Updated Key Name',
      scopes: ['users.read', 'users.write'],
    })

    expect(updated.name).toBe('Updated Key Name')
    expect(updated.scopes).toEqual(['users.read', 'users.write'])
  })

  test('deletes a key', async () => {
    const created = await keysService.create(projectId, {
      name: 'To Delete Key',
      scopes: ['*'],
    })

    await keysService.delete(projectId, created.$id)
    await expect(keysService.get(projectId, created.$id)).rejects.toThrow()
  })
})
