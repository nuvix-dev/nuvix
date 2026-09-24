process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { beforeAll, describe, expect, test } from 'bun:test'
import { decodeEncryptionKey, FakeTenantProvisioner } from '@nuvix/core/tenants'
import type { Database } from '@nuvix/db'
import { createPlatformDatabase } from '../../registry/setup'
import { ProjectService } from './service'

let db: Database

/** `FakeTenantProvisioner`'s target isn't a real Postgres instance — never attempt a real bootstrap connection against it in unit tests. */
const noopBootstrap = async () => {}
const encryptionKey = decodeEncryptionKey(process.env.NUVIX_TENANT_ENCRYPTION_KEY!)
const jwtSecret = 'test-jwt-secret-for-project'

beforeAll(async () => {
  db = await createPlatformDatabase()
})

describe('ProjectService', () => {
  test('create provisions a tenant and persists an active project with defaults', async () => {
    const provisioner = new FakeTenantProvisioner()
    const service = new ProjectService(db, provisioner, noopBootstrap, jwtSecret, encryptionKey)

    const project = await service.create({ name: 'Demo' })

    expect(project.name).toBe('Demo')
    expect(project.status).toBe('active')
    expect(project.publishableKey).toMatch(/^pk_[0-9a-f]{32}$/)
    expect(project.containerName).toBe(`fake-tenant-${project.$id}`)
    expect(provisioner.provisioned.has(project.$id)).toBe(true)
    // The tenant's connection secret is never part of the public view.
    expect(project).not.toHaveProperty('target')
    expect(project.services?.account).toBe(true)
    expect(project.apis?.rest).toBe(true)
    expect(project.metadata).toEqual({ allowedSchemas: ['public'] })
  })

  test('create generates a distinct publishable selector for every project', async () => {
    const service = new ProjectService(db, new FakeTenantProvisioner(), noopBootstrap)

    const first = await service.create({ name: 'First selector' })
    const second = await service.create({ name: 'Second selector' })

    expect(first.publishableKey).not.toBe(second.publishableKey)
  })

  test('create records status: error and rethrows when the tenant never becomes ready', async () => {
    const provisioner = new FakeTenantProvisioner()
    provisioner.waitUntilReady = async () => {
      throw new Error('connection refused')
    }
    const service = new ProjectService(db, provisioner, noopBootstrap)

    await expect(service.create({ name: 'Broken' })).rejects.toThrow(
      /Failed to provision tenant database/,
    )

    const projects = (await service.list(100, 0)).projects
    const failed = projects.find((p) => p.name === 'Broken')
    expect(failed?.status).toBe('error')
    expect(failed?.errorMessage).toBe('connection refused')
  })

  test('update updates project details', async () => {
    const service = new ProjectService(db, new FakeTenantProvisioner(), noopBootstrap)
    const project = await service.create({ name: 'Original Name' })

    const updated = await service.update(project.$id, {
      name: 'New Name',
      description: 'New Description',
      logo: 'logo.png',
      url: 'https://example.com',
    })

    expect(updated.name).toBe('New Name')
    expect(updated.description).toBe('New Description')
    expect(updated.logo).toBe('logo.png')
    expect(updated.url).toBe('https://example.com')
  })

  test('updateServiceStatus and updateAllServiceStatus manage services', async () => {
    const service = new ProjectService(db, new FakeTenantProvisioner(), noopBootstrap)
    const project = await service.create({ name: 'Services Test' })

    const updatedOne = await service.updateServiceStatus(project.$id, {
      service: 'storage',
      status: false,
    })
    expect(updatedOne.services?.storage).toBe(false)

    await expect(
      service.updateServiceStatus(project.$id, {
        service: 'unknown-service',
        status: false,
      }),
    ).rejects.toThrow(/Unknown service/)

    const updatedAll = await service.updateAllServiceStatus(project.$id, false)
    expect(updatedAll.services?.storage).toBe(false)
    expect(updatedAll.services?.account).toBe(false)
  })

  test('updateApiStatus and updateAllApiStatus manage APIs', async () => {
    const service = new ProjectService(db, new FakeTenantProvisioner(), noopBootstrap)
    const project = await service.create({ name: 'APIs Test' })

    const updatedOne = await service.updateApiStatus(project.$id, {
      api: 'rest',
      status: false,
    })
    expect(updatedOne.apis?.rest).toBe(false)

    await expect(
      service.updateApiStatus(project.$id, {
        api: 'graphql',
        status: false,
      }),
    ).rejects.toThrow(/Unknown API/)

    const updatedAll = await service.updateAllApiStatus(project.$id, true)
    expect(updatedAll.apis?.rest).toBe(true)
  })

  test('updateOAuth2 updates provider config', async () => {
    const service = new ProjectService(
      db,
      new FakeTenantProvisioner(),
      noopBootstrap,
      jwtSecret,
      encryptionKey,
    )
    const project = await service.create({ name: 'OAuth Test' })

    const updated = await service.updateOAuth2(project.$id, {
      provider: 'google',
      appId: 'google-client-id',
      secret: 'google-client-secret',
      enabled: true,
    })

    const google = (
      updated.oAuthProviders as Array<{
        key: string
        appId?: string
        enabled: boolean
      }>
    )?.find((p) => p.key === 'google')
    expect(google?.appId).toBe('google-client-id')
    expect(google?.enabled).toBe(true)

    await expect(
      service.updateOAuth2(project.$id, {
        provider: 'non-existent-provider',
      }),
    ).rejects.toThrow(/OAuth provider not found/)
  })

  test('updateSMTP validates arguments and stores SMTP configuration', async () => {
    const service = new ProjectService(db, new FakeTenantProvisioner(), noopBootstrap)
    const project = await service.create({ name: 'SMTP Test' })

    await expect(
      service.updateSMTP(project.$id, {
        enabled: true,
        // missing senderName, host, etc.
      }),
    ).rejects.toThrow(/Sender name is required/)

    const updated = await service.updateSMTP(project.$id, {
      enabled: true,
      senderName: 'Nuvix Support',
      senderEmail: 'support@nuvix.io',
      host: 'smtp.nuvix.io',
      port: 587,
    })

    expect(updated.smtp?.enabled).toBe(true)
    expect(updated.smtp?.senderName).toBe('Nuvix Support')
    expect(updated.smtp?.host).toBe('smtp.nuvix.io')

    const disabled = await service.updateSMTP(project.$id, {
      enabled: false,
    })
    expect(disabled.smtp?.enabled).toBe(false)
  })

  test('createJwt generates signed dynamic JWT', async () => {
    const service = new ProjectService(db, new FakeTenantProvisioner(), noopBootstrap, jwtSecret)
    const project = await service.create({ name: 'JWT Test' })

    const result = await service.createJwt(project.$id, {
      scopes: ['projects.read', 'projects.write'],
      duration: 3600,
    })

    expect(result.jwt.startsWith('dynamic_')).toBe(true)
  })

  test('testSMTP throws NotImplementedError', async () => {
    const service = new ProjectService(db, new FakeTenantProvisioner(), noopBootstrap)
    const project = await service.create({ name: 'SMTP Test 2' })
    await expect(service.testSMTP(project.$id)).rejects.toThrow('SMTP test is not implemented')
  })

  test('getUsage returns project usage statistics', async () => {
    const service = new ProjectService(db, new FakeTenantProvisioner(), noopBootstrap)
    const project = await service.create({ name: 'Usage Project' })
    const usage = await service.getUsage(project.$id, '30d')

    expect(usage.requests).toBeDefined()
    expect(usage.network).toBeDefined()
    expect(usage.users).toBeDefined()
    expect(usage.documentsTotal).toBe(0)
    expect(usage.usersTotal).toBe(0)
    expect(usage.bucketsTotal).toBe(0)
    expect(usage.filesStorageTotal).toBe(0)
    expect(Array.isArray(usage.bucketsBreakdown)).toBe(true)
  })

  test('get throws NotFoundError for an unknown id', async () => {
    const service = new ProjectService(db, new FakeTenantProvisioner(), noopBootstrap)
    await expect(service.get('does-not-exist')).rejects.toThrow('Project not found')
  })

  test('delete deprovisions the tenant and removes the record', async () => {
    const provisioner = new FakeTenantProvisioner()
    const service = new ProjectService(db, provisioner, noopBootstrap)
    const project = await service.create({ name: 'ToDelete' })

    await service.delete(project.$id)

    expect(provisioner.provisioned.has(project.$id)).toBe(false)
    await expect(service.get(project.$id)).rejects.toThrow('Project not found')
  })

  test('list paginates with limit/offset and reports total', async () => {
    const service = new ProjectService(db, new FakeTenantProvisioner(), noopBootstrap)
    for (let i = 0; i < 3; i++) {
      await service.create({ name: `Page-${i}` })
    }

    const page = await service.list(2, 0)
    expect(page.projects.length).toBe(2)
    expect(page.total).toBeGreaterThanOrEqual(3)
  })
})
