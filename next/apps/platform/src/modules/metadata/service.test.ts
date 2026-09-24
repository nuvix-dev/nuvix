process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { beforeAll, describe, expect, test } from 'bun:test'
import { FakeTenantProvisioner } from '@nuvix/core/tenants'
import type { Database } from '@nuvix/db'
import { createPlatformDatabase } from '../../registry/setup'
import { ProjectService } from '../projects/service'
import { MetadataService } from './service'

let db: Database
let projectService: ProjectService
let metadataService: MetadataService

beforeAll(async () => {
  db = await createPlatformDatabase()
  projectService = new ProjectService(db, new FakeTenantProvisioner(), async () => {})
  metadataService = new MetadataService(db)
})

describe('MetadataService', () => {
  test('updateExposedSchemas updates allowedSchemas on project metadata', async () => {
    const project = await projectService.create({ name: 'Metadata Test' })

    const updated = await metadataService.updateExposedSchemas(project.$id, [
      'public',
      'custom_schema',
    ])

    expect(updated.metadata?.allowedSchemas).toEqual(['public', 'custom_schema'])
  })

  test('updateExposedSchemas throws NotFoundError for unknown project', async () => {
    await expect(metadataService.updateExposedSchemas('missing-proj', ['public'])).rejects.toThrow(
      'Project not found',
    )
  })
})
