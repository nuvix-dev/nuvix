process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { beforeAll, describe, expect, test } from 'bun:test'
import { FakeTenantProvisioner } from '@nuvix/core/tenants'
import type { Database } from '@nuvix/db'
import { createPlatformDatabase } from '../../registry/setup'
import { ProjectService } from './service'

let db: Database

beforeAll(async () => {
  db = await createPlatformDatabase()
})

describe('ProjectService', () => {
  test('create provisions a tenant and persists an active project', async () => {
    const provisioner = new FakeTenantProvisioner()
    const service = new ProjectService(db, provisioner)

    const project = await service.create({ name: 'Demo' })

    expect(project.name).toBe('Demo')
    expect(project.status).toBe('active')
    expect(project.containerName).toBe(`fake-tenant-${project.$id}`)
    expect(provisioner.provisioned.has(project.$id)).toBe(true)
    // The tenant's connection secret is never part of the public view.
    expect(project).not.toHaveProperty('target')
  })

  test('create records status: error and rethrows when the tenant never becomes ready', async () => {
    const provisioner = new FakeTenantProvisioner()
    provisioner.waitUntilReady = async () => {
      throw new Error('connection refused')
    }
    const service = new ProjectService(db, provisioner)

    await expect(service.create({ name: 'Broken' })).rejects.toThrow(
      /Failed to provision tenant database/,
    )

    const projects = (await service.list(100, 0)).projects
    const failed = projects.find((p) => p.name === 'Broken')
    expect(failed?.status).toBe('error')
    expect(failed?.errorMessage).toBe('connection refused')
  })

  test('get throws NotFoundError for an unknown id', async () => {
    const service = new ProjectService(db, new FakeTenantProvisioner())
    await expect(service.get('does-not-exist')).rejects.toThrow('Project not found')
  })

  test('delete deprovisions the tenant and removes the record', async () => {
    const provisioner = new FakeTenantProvisioner()
    const service = new ProjectService(db, provisioner)
    const project = await service.create({ name: 'ToDelete' })

    await service.delete(project.$id)

    expect(provisioner.provisioned.has(project.$id)).toBe(false)
    await expect(service.get(project.$id)).rejects.toThrow('Project not found')
  })

  test('list paginates with limit/offset and reports total', async () => {
    const service = new ProjectService(db, new FakeTenantProvisioner())
    for (let i = 0; i < 3; i++) {
      await service.create({ name: `Page-${i}` })
    }

    const page = await service.list(2, 0)
    expect(page.projects.length).toBe(2)
    expect(page.total).toBeGreaterThanOrEqual(3)
  })
})
