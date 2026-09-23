import { describe, expect, it } from 'bun:test'
import { treaty } from '@elysia/eden'
import { Elysia } from 'elysia'
import { problemErrors } from '../../plugins/errors'
import { ConflictError, NotFoundError } from '../../shared/errors'
import { databaseRoutes } from './routes'
import type { DatabaseService } from './service'
import type { CreateSchemaInput, SchemaType, SchemaView, UpdateSchemaInput } from './types'

describe('database routes', () => {
  const schemasStore = new Map<string, SchemaView>([
    ['appdata', { name: 'appdata', description: 'Application data', type: 'managed' }],
    ['documents', { name: 'documents', description: null, type: 'document' }],
  ])

  let currentAuth = { isAdmin: true, isApiKey: false, roles: ['admin'] }

  const mockService = {
    list: (type?: SchemaType) => {
      const items = [...schemasStore.values()].filter((s) => (type ? s.type === type : true))
      return Promise.resolve({ data: items, meta: { total: items.length } })
    },
    get: (name: string) => {
      const item = schemasStore.get(name)
      if (!item) throw new NotFoundError('Schema', { code: 'schema_not_found' })
      return Promise.resolve(item)
    },
    create: (input: CreateSchemaInput) => {
      if (schemasStore.has(input.name)) {
        throw new ConflictError('Schema already exists', { code: 'schema_already_exists' })
      }
      const item: SchemaView = {
        name: input.name,
        description: input.description ?? null,
        type: input.type,
      }
      schemasStore.set(input.name, item)
      return Promise.resolve(item)
    },
    update: (name: string, input: UpdateSchemaInput) => {
      const item = schemasStore.get(name)
      if (!item) throw new NotFoundError('Schema', { code: 'schema_not_found' })
      item.description = input.description ?? null
      return Promise.resolve(item)
    },
    delete: (name: string) => {
      if (!schemasStore.has(name)) {
        throw new NotFoundError('Schema', { code: 'schema_not_found' })
      }
      schemasStore.delete(name)
      return Promise.resolve()
    },
  } as unknown as DatabaseService

  const app = new Elysia({ prefix: '/v2' })
    .use(
      problemErrors({
        getTranslator: () =>
          Promise.resolve({
            format: (k: string) => k,
          }) as never,
      }),
    )
    .use(databaseRoutes(mockService, () => currentAuth))

  const client = treaty(app)

  it('GET /database/schemas lists schemas with meta', async () => {
    currentAuth = { isAdmin: true, isApiKey: false, roles: ['admin'] }
    const { data, status } = await client.v2.database.schemas.get()
    expect(status).toBe(200)
    expect(data?.meta.total).toBe(2)
    expect(data?.data[0]?.name).toBe('appdata')
  })

  it('GET /database/schemas rejects non-admin callers with 403', async () => {
    currentAuth = { isAdmin: false, isApiKey: false, roles: ['user:123'] }
    const res = await app.handle(new Request('http://localhost/v2/database/schemas'))
    expect(res.status).toBe(403)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('general_access_forbidden')
  })

  it('POST /database/schemas creates a schema', async () => {
    currentAuth = { isAdmin: true, isApiKey: false, roles: ['admin'] }
    const { data, status } = await client.v2.database.schemas.post({
      name: 'analytics',
      type: 'managed',
      description: 'Analytics data',
    })
    expect(status).toBe(200)
    expect(data?.name).toBe('analytics')
    expect(data?.type).toBe('managed')
  })

  it('POST /database/schemas returns 409 for duplicate schema', async () => {
    currentAuth = { isAdmin: true, isApiKey: false, roles: ['admin'] }
    const res = await app.handle(
      new Request('http://localhost/v2/database/schemas', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'appdata',
          type: 'managed',
        }),
      }),
    )
    expect(res.status).toBe(409)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('schema_already_exists')
  })

  it('GET /database/schemas/:name returns schema', async () => {
    currentAuth = { isAdmin: true, isApiKey: false, roles: ['admin'] }
    const { data, status } = await client.v2.database.schemas({ name: 'appdata' }).get()
    expect(status).toBe(200)
    expect(data?.name).toBe('appdata')
    expect(data?.type).toBe('managed')
  })

  it('GET /database/schemas/:name returns 404 for unknown schema', async () => {
    currentAuth = { isAdmin: true, isApiKey: false, roles: ['admin'] }
    const res = await app.handle(new Request('http://localhost/v2/database/schemas/unknown'))
    expect(res.status).toBe(404)
    const body = (await res.json()) as { code: string }
    expect(body.code).toBe('schema_not_found')
  })

  it('PATCH /database/schemas/:name updates description', async () => {
    currentAuth = { isAdmin: true, isApiKey: false, roles: ['admin'] }
    const { data, status } = await client.v2.database
      .schemas({ name: 'appdata' })
      .patch({ description: 'Updated appdata' })
    expect(status).toBe(200)
    expect(data?.description).toBe('Updated appdata')
  })

  it('DELETE /database/schemas/:name returns 204 and deletes schema', async () => {
    currentAuth = { isAdmin: true, isApiKey: false, roles: ['admin'] }
    const res = await app.handle(
      new Request('http://localhost/v2/database/schemas/appdata', {
        method: 'DELETE',
      }),
    )
    expect(res.status).toBe(204)
    expect(schemasStore.has('appdata')).toBe(false)
  })
})
