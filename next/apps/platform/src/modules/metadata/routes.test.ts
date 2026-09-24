process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { beforeAll, describe, expect, test } from 'bun:test'
import { treaty } from '@elysia/eden'
import { FakeTenantProvisioner } from '@nuvix/core/tenants'
import { Elysia } from 'elysia'
import { problemErrors } from '../../plugins/errors'
import { createPlatformDatabase } from '../../registry/setup'
import { ProjectService } from '../projects/service'
import { metadataRoutes } from './routes'
import { MetadataService } from './service'

let projectService: ProjectService

async function buildApp() {
  const db = await createPlatformDatabase()
  projectService = new ProjectService(db, new FakeTenantProvisioner(), async () => {})
  const service = new MetadataService(db)
  const app = new Elysia().use(problemErrors()).use(metadataRoutes(service))
  return treaty(app)
}

let client: Awaited<ReturnType<typeof buildApp>>

beforeAll(async () => {
  client = await buildApp()
})

describe('metadata routes', () => {
  test('PUT /projects/:projectId/metadata/exposed-schemas updates allowed schemas', async () => {
    const project = await projectService.create({ name: 'Metadata Route Test' })

    const res = await client
      .projects({ projectId: project.$id })
      .metadata['exposed-schemas'].put({ schemas: ['public', 'auth'] })

    expect(res.status).toBe(200)
    expect(res.data?.metadata?.allowedSchemas).toEqual(['public', 'auth'])
  })

  test('PUT /projects/:projectId/metadata/exposed-schemas returns 404 for unknown project', async () => {
    const res = await client
      .projects({ projectId: 'non-existent' })
      .metadata['exposed-schemas'].put({ schemas: ['public'] })

    expect(res.status).toBe(404)
  })
})
