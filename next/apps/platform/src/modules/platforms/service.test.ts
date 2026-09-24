process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { beforeAll, describe, expect, test } from 'bun:test'
import { FakeTenantProvisioner } from '@nuvix/core/tenants'
import type { Database } from '@nuvix/db'
import { createPlatformDatabase } from '../../registry/setup'
import { ProjectService } from '../projects/service'
import { PlatformsService } from './service'

let db: Database
let projectService: ProjectService
let platformsService: PlatformsService
let projectId: string

const noopBootstrap = async () => {}

beforeAll(async () => {
  db = await createPlatformDatabase()
  projectService = new ProjectService(db, new FakeTenantProvisioner(), noopBootstrap)
  platformsService = new PlatformsService(db)

  const project = await projectService.create({ name: 'Platforms Test Project' })
  projectId = project.$id
})

describe('PlatformsService', () => {
  test('creates a platform for a project', async () => {
    const platform = await platformsService.create(projectId, {
      type: 'web',
      name: 'Web Dashboard',
      hostname: 'app.example.com',
    })

    expect(platform.projectId).toBe(projectId)
    expect(platform.type).toBe('web')
    expect(platform.name).toBe('Web Dashboard')
    expect(platform.hostname).toBe('app.example.com')
  })

  test('lists platforms for a project', async () => {
    const { platforms, total } = await platformsService.list(projectId)
    expect(total).toBeGreaterThanOrEqual(1)
    expect(platforms.length).toBeGreaterThanOrEqual(1)
  })

  test('gets a platform by id', async () => {
    const created = await platformsService.create(projectId, {
      type: 'flutter',
      name: 'Mobile App',
      key: 'com.example.mobile',
    })

    const fetched = await platformsService.get(projectId, created.$id)
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.name).toBe('Mobile App')
    expect(fetched.key).toBe('com.example.mobile')
  })

  test('updates a platform', async () => {
    const created = await platformsService.create(projectId, {
      type: 'android',
      name: 'Android App',
      key: 'com.example.android',
    })

    const updated = await platformsService.update(projectId, created.$id, {
      name: 'Updated Android App',
      key: 'com.example.android.updated',
    })

    expect(updated.name).toBe('Updated Android App')
    expect(updated.key).toBe('com.example.android.updated')
  })

  test('deletes a platform', async () => {
    const created = await platformsService.create(projectId, {
      type: 'apple-ios',
      name: 'iOS App',
    })

    await platformsService.delete(projectId, created.$id)
    await expect(platformsService.get(projectId, created.$id)).rejects.toThrow()
  })
})
