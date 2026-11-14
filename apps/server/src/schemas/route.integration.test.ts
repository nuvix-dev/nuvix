/**
 * LIVE verification of the `/database/schemas` + `/schemas/:schemaId/...`
 * DB routes against a real `nuvix/postgres:18.1` container.
 *
 * Provisions a container with the production `DockerTenantProvisioner`,
 * bootstraps the `auth` schema exactly like a real tenant, and exercises
 * the DB routes with the production service defaults (no test fakes).
 * Skips when Docker/the pinned image is unavailable — never simulates
 * live coverage.
 */
process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { describe, expect, test } from 'bun:test'
import { treaty } from '@elysia/eden'
import { Auth } from '@nuvix/core/auth'
import { bootstrapAuthSchema } from '@nuvix/core/tenant-auth'
import { DockerTenantProvisioner, type TenantResource } from '@nuvix/core/tenants'
import { Doc } from '@nuvix/db'
import { Elysia } from 'elysia'
import { databaseRoutes } from '../database/route'
import { problemErrors } from '../plugins/errors'
import { schemasRoutes } from './route'

/** Detects the pinned tenant image without masking a missing Docker runtime. */
async function dockerAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(['docker', 'image', 'inspect', 'nuvix/postgres:18.1'], {
      stdout: 'ignore',
      stderr: 'ignore',
    })
    return (await proc.exited) === 0
  } catch {
    return false
  }
}

const hasDocker = await dockerAvailable()
// Unique per run: provisioning is NOT idempotent — the deterministic
// volume name persists a run's data dir (and its nuvix_admin password),
// so a second run against the same name fails credential auth.
const RUN = Date.now().toString().slice(-6)
const SCHEMA_NAME = `dbroute${RUN}`
// Document collections live in physical tables named `{schema}_{collectionId}`.
const TABLE = `dbroute${RUN}_todos`

describe.skipIf(!hasDocker)('/database + /schemas routes (live nuvix/postgres:18.1)', () => {
  const projectId = `live-db-routes-${RUN}`
  const provisioner = new DockerTenantProvisioner()
  let target: Awaited<ReturnType<DockerTenantProvisioner['provision']>>['target']
  let handle: Awaited<ReturnType<DockerTenantProvisioner['provision']>>['handle']
  let tenantResource: TenantResource

  test('provisions a real tenant container + auth schema', async () => {
    const provisioned = await provisioner.provision({ projectId })
    target = provisioned.target
    handle = provisioned.handle
    await provisioner.waitUntilReady(target)
    await bootstrapAuthSchema(target) // production tenant shape

    tenantResource = new (await import('@nuvix/core/tenants')).TenantResource(projectId, target)
    await tenantResource.getSql()`select 1`

    return async () => {
      // deprovision helper executed in the final cleanup test.
    }
  }, 240_000)

  test('schema CRUD on /database/schemas incl. document-schema metadata seeding', async () => {
    const client = treaty(buildApp(tenantResource))

    // Document-typed create runs system.create_schema DDL AND seeds the
    // @nuvix/db metadata collections inside the new schema.
    const created = await client.database.schemas.post({
      name: SCHEMA_NAME,
      type: 'document',
      description: 'live verification',
    })
    expect(created.status).toBe(200)
    expect(created.data?.name).toBe(SCHEMA_NAME)
    expect(created.data?.type).toBe('document')

    // List contains it.
    const list = await client.database.schemas.get()
    expect(list.status).toBe(200)
    expect(
      (list.data as unknown as { data: Array<{ name: string }> }).data.some(
        (s) => s.name === SCHEMA_NAME,
      ),
    ).toBe(true)

    // Description update.
    const patched = await client.database.schemas({ schemaId: SCHEMA_NAME }).patch({
      description: 'updated description',
    })
    expect(patched.status).toBe(200)
    expect((patched.data as unknown as { description: string }).description).toBe(
      'updated description',
    )

    // Duplicate create → conflict.
    const dup = await client.database.schemas.post({
      name: SCHEMA_NAME,
      type: 'document',
    })
    expect(dup.status).toBe(409)
  }, 120_000)

  test('collection → attributes → indexes → documents lifecycle in the live schema', async () => {
    const schemas = treaty(buildApp(tenantResource)).schemas({
      schemaId: SCHEMA_NAME,
    })

    // ── Collections ──
    const col = await schemas.collections.post({
      collectionId: 'todos',
      name: 'Todos',
      enabled: true,
      documentSecurity: true,
    })
    expect(col.status).toBe(200)
    expect(col.data?.$id).toBe('todos')

    const colList = await schemas.collections.get()
    expect((colList.data as { total: number }).total).toBe(1)

    const renamed = await schemas.collections({ collectionId: 'todos' }).put({ name: 'ToDos' })
    expect(renamed.status).toBe(200)
    expect((renamed.data as { name: string }).name).toBe('ToDos')

    const usage = await schemas.collections({ collectionId: 'todos' }).usage.get()
    expect(usage.status).toBe(200)

    // ── Attributes ──
    const taskAttr = await schemas
      .collections({ collectionId: 'todos' })
      .attributes.string.post({ key: 'task', size: 255, required: true })
    expect(taskAttr.status).toBe(200)

    const orderAttr = await schemas
      .collections({ collectionId: 'todos' })
      .attributes.integer.post({ key: 'sort_order', default: 0 })
    expect(orderAttr.status).toBe(200)

    const statusAttr = await schemas.collections({ collectionId: 'todos' }).attributes.enum.post({
      key: 'status',
      elements: ['todo', 'doing', 'done'],
      default: 'todo',
    })
    expect(statusAttr.status).toBe(200)

    const attrList = await schemas.collections({ collectionId: 'todos' }).attributes.get()
    expect((attrList.data as { total: number }).total).toBe(3)

    const patchedAttr = await schemas
      .collections({ collectionId: 'todos' })
      .attributes({ key: 'task' })
      .patch({ required: false })
    expect(patchedAttr.status).toBe(200)

    // ── Indexes ──
    const idx = await schemas.collections({ collectionId: 'todos' }).indexes.post({
      key: 'idx_task',
      type: 'key' as never,
      attributes: ['task'] as never,
    })
    expect(idx.status).toBe(200)
    expect((idx.data as unknown as { key: string }).key).toBe('idx_task')

    // ── Documents ──
    const doc = await schemas.collections({ collectionId: 'todos' }).documents.post({
      documentId: 'todo_1',
      data: { task: 'Buy milk', sort_order: 1, status: 'todo' },
    })
    expect(doc.status).toBe(200)
    expect((doc.data as unknown as { task: string }).task).toBe('Buy milk')

    const doc2 = await schemas.collections({ collectionId: 'todos' }).documents.post({
      data: { task: 'Ship v2', sort_order: 2, status: 'doing' },
    })
    expect(doc2.status).toBe(200)

    const docList = await schemas.collections({ collectionId: 'todos' }).documents.get()
    expect(docList.status).toBe(200)
    expect((docList.data as { total: number }).total).toBe(2)

    const updatedDoc = await schemas
      .collections({ collectionId: 'todos' })
      .documents({ documentId: 'todo_1' })
      .patch({ data: { status: 'done' } })
    expect(updatedDoc.status).toBe(200)
    expect((updatedDoc.data as unknown as { status: string }).status).toBe('done')

    const deletedDoc = await schemas
      .collections({ collectionId: 'todos' })
      .documents({ documentId: 'todo_1' })
      .delete()
    expect(deletedDoc.status).toBe(204)
  }, 180_000)

  test('tables surface reads the real table rows (schema-shaped route)', async () => {
    const client = treaty(buildApp(tenantResource))

    const rows = await client.schemas({ schemaId: SCHEMA_NAME }).tables({ tableId: TABLE }).get()
    expect(rows.status).toBe(200)
    const data = rows.data as unknown as Array<Record<string, unknown>>
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBe(1)

    const count = await client
      .schemas({ schemaId: SCHEMA_NAME })
      .tables({ tableId: TABLE })
      .count.get()
    expect((count.data as { count: number }).count).toBe(1)

    // Insert through the admin table surface and re-count.
    const inserted = await client
      .schemas({ schemaId: SCHEMA_NAME })
      .tables({ tableId: TABLE })
      .post({ task: 'via tables route', sort_order: 3, status: 'todo' })
    expect(inserted.status).toBe(200)

    const count2 = await client
      .schemas({ schemaId: SCHEMA_NAME })
      .tables({ tableId: TABLE })
      .count.get()
    expect((count2.data as { count: number }).count).toBe(2)
  }, 120_000)

  test('non-admin callers are forbidden on collections', async () => {
    const app = new Elysia()
      .use(
        problemErrors({
          getTranslator: async () =>
            new (await import('@nuvix/i18n')).Translator('en', 'en', {
              primary: {},
              fallback: {},
            }),
        }),
      )
      .derive('plugin', () => ({
        isAdmin: false,
        isAPIUser: false,
        user: new Doc({ $id: 'guest' }),
        tenantResource,
        db: tenantResource.sessionForSchema(SCHEMA_NAME, ['user:guest']),
        roles: ['user:guest'],
      }))
      .use(schemasRoutes())

    const res = await app.handle(new Request(`http://localhost/schemas/${SCHEMA_NAME}/collections`))
    expect(res.status).toBe(403)
    const body = (await res.json()) as { code?: string }
    expect(body.code).toBe('user_forbidden')
  })

  test('cleanup: collection + schema drop leaves a clean tenant', async () => {
    const client = treaty(buildApp(tenantResource))

    const delCol = await client
      .schemas({ schemaId: SCHEMA_NAME })
      .collections({ collectionId: 'todos' })
      .delete()
    expect(delCol.status).toBe(204)

    const dropSchema = await client.database.schemas({ schemaId: SCHEMA_NAME }).delete()
    expect(dropSchema.status).toBe(204)

    const gone = await client.database.schemas({ schemaId: SCHEMA_NAME }).get()
    expect(gone.status).toBe(404)
  }, 120_000)

  test('deprovisions the tenant container', async () => {
    if (tenantResource) await (tenantResource as { close(): Promise<void> }).close()
    if (handle) await provisioner.deprovision(handle)
  })
})

function buildApp(resource: TenantResource) {
  return new Elysia()
    .use(
      problemErrors({
        getTranslator: async () =>
          new (await import('@nuvix/i18n')).Translator('en', 'en', {
            primary: {},
            fallback: {},
          }),
      }),
    )
    .derive('plugin', () => ({
      isAdmin: true,
      isAPIUser: true,
      user: new Doc({ $id: 'admin_user' }),
      tenantResource: resource,
      db: resource.systemSessionForSchema('public'),
      roles: Auth.getRoles(new Doc({ $id: 'admin_user' }), true, true),
    }))
    .use(databaseRoutes())
    .use(schemasRoutes())
}
