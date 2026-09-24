process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { beforeAll, describe, expect, test } from 'bun:test'
import { FakeTenantProvisioner } from '@nuvix/core/tenants'
import type { Database } from '@nuvix/db'
import { createPlatformDatabase } from '../../registry/setup'
import { ProjectService } from '../projects/service'
import { WebhooksService } from './service'

let db: Database
let projectService: ProjectService
let webhooksService: WebhooksService
let projectId: string

const noopBootstrap = async () => {}

beforeAll(async () => {
  db = await createPlatformDatabase()
  projectService = new ProjectService(db, new FakeTenantProvisioner(), noopBootstrap)
  webhooksService = new WebhooksService(db)

  const project = await projectService.create({ name: 'Webhooks Test Project' })
  projectId = project.$id
})

describe('WebhooksService', () => {
  test('creates a webhook for a project', async () => {
    const webhook = await webhooksService.create(projectId, {
      name: 'User Created Webhook',
      url: 'https://example.com/webhook',
      events: ['users.create', 'users.update'],
      security: true,
      httpUser: 'admin',
      httpPass: 'secretpass',
    })

    expect(webhook.projectId).toBe(projectId)
    expect(webhook.name).toBe('User Created Webhook')
    expect(webhook.url).toBe('https://example.com/webhook')
    expect(webhook.events).toEqual(['users.create', 'users.update'])
    expect(webhook.security).toBe(true)
    expect(webhook.enabled).toBe(true)
    expect(webhook.signatureKey).toBeDefined()
    expect((webhook as unknown as Record<string, unknown>).httpPass).toBeUndefined()
  })

  test('lists webhooks for a project', async () => {
    const { webhooks, total } = await webhooksService.list(projectId)
    expect(total).toBeGreaterThanOrEqual(1)
    expect(webhooks.length).toBeGreaterThanOrEqual(1)
  })

  test('gets a webhook by id', async () => {
    const created = await webhooksService.create(projectId, {
      name: 'To Get',
      url: 'https://example.com/get',
      events: ['files.create'],
    })

    const fetched = await webhooksService.get(projectId, created.$id)
    expect(fetched.$id).toBe(created.$id)
    expect(fetched.name).toBe('To Get')
  })

  test('updates a webhook', async () => {
    const created = await webhooksService.create(projectId, {
      name: 'Initial Name',
      url: 'https://example.com/before',
      events: ['*'],
    })

    const updated = await webhooksService.update(projectId, created.$id, {
      name: 'Updated Name',
      url: 'https://example.com/after',
      enabled: false,
    })

    expect(updated.name).toBe('Updated Name')
    expect(updated.url).toBe('https://example.com/after')
    expect(updated.enabled).toBe(false)

    // Re-enabling resets attempts
    const reEnabled = await webhooksService.update(projectId, created.$id, {
      enabled: true,
    })
    expect(reEnabled.enabled).toBe(true)
    expect(reEnabled.attempts).toBe(0)
  })

  test('rotates signature key for a webhook', async () => {
    const created = await webhooksService.create(projectId, {
      name: 'Key Rotation Test',
      url: 'https://example.com/rotate',
      events: ['*'],
    })

    const rotated = await webhooksService.updateSignature(projectId, created.$id)
    expect(rotated.signatureKey).toBeDefined()
    expect(rotated.signatureKey).not.toBe(created.signatureKey)
  })

  test('deletes a webhook', async () => {
    const created = await webhooksService.create(projectId, {
      name: 'To Delete',
      url: 'https://example.com/del',
      events: ['*'],
    })

    await webhooksService.delete(projectId, created.$id)
    await expect(webhooksService.get(projectId, created.$id)).rejects.toThrow()
  })
})
