import { Elysia, t } from 'elysia'
import { ForbiddenError } from '../../shared/errors'
import type { DatabaseService } from './service'
import type { SchemaType } from './types'

export const SchemaObjectSchema = t.Object({
  name: t.String({ pattern: '^[a-z][a-z0-9_]{0,254}$' }),
  description: t.Nullable(t.String()),
  type: t.Union([t.Literal('document'), t.Literal('managed'), t.Literal('unmanaged')]),
})

export interface DatabaseCallerAuth {
  isAdmin?: boolean
  isApiKey?: boolean
  roles?: string[]
}

function requireAdminAuth(caller: DatabaseCallerAuth): void {
  const isAdmin =
    caller.isAdmin ||
    caller.isApiKey ||
    caller.roles?.includes('admin') ||
    caller.roles?.includes('role:admin') ||
    caller.roles?.includes('owner')

  if (!isAdmin) {
    throw new ForbiddenError('Access forbidden', { code: 'general_access_forbidden' })
  }
}

export type DatabaseServiceResolver =
  | DatabaseService
  | ((request: Request) => Promise<DatabaseService> | DatabaseService)

function getService(
  service: DatabaseServiceResolver,
  request: Request,
): Promise<DatabaseService> | DatabaseService {
  return typeof service === 'function' ? service(request) : service
}

export function databaseRoutes(
  service: DatabaseServiceResolver,
  getCallerAuth: (request: Request) => DatabaseCallerAuth = () => ({ isAdmin: true }),
) {
  return new Elysia({ name: 'database-routes' })
    .get(
      '/database/schemas',
      {
        query: t.Object({
          type: t.Optional(
            t.Union([t.Literal('document'), t.Literal('managed'), t.Literal('unmanaged')]),
          ),
        }),
        response: t.Object({
          data: t.Array(SchemaObjectSchema),
          meta: t.Object({ total: t.Number() }),
        }),
        detail: { summary: 'List schemas', tags: ['database'] },
      },
      async ({ query, request }) => {
        requireAdminAuth(getCallerAuth(request))
        return (await getService(service, request)).list(query.type as SchemaType | undefined)
      },
    )
    .post(
      '/database/schemas',
      {
        body: t.Object({
          name: t.String({ pattern: '^[a-z][a-z0-9_]{0,254}$' }),
          description: t.Optional(t.Nullable(t.String({ maxLength: 255 }))),
          type: t.Union([t.Literal('document'), t.Literal('managed'), t.Literal('unmanaged')]),
        }),
        response: SchemaObjectSchema,
        detail: { summary: 'Create schema', tags: ['database'] },
      },
      async ({ body, request }) => {
        requireAdminAuth(getCallerAuth(request))
        return (await getService(service, request)).create(body)
      },
    )
    .get(
      '/database/schemas/:name',
      {
        params: t.Object({ name: t.String() }),
        response: SchemaObjectSchema,
        detail: { summary: 'Get schema', tags: ['database'] },
      },
      async ({ params: { name }, request }) => {
        requireAdminAuth(getCallerAuth(request))
        return (await getService(service, request)).get(name)
      },
    )
    .patch(
      '/database/schemas/:name',
      {
        params: t.Object({ name: t.String() }),
        body: t.Object({
          description: t.Optional(t.Nullable(t.String({ maxLength: 255 }))),
        }),
        response: SchemaObjectSchema,
        detail: { summary: 'Update schema description', tags: ['database'] },
      },
      async ({ params: { name }, body, request }) => {
        requireAdminAuth(getCallerAuth(request))
        return (await getService(service, request)).update(name, body)
      },
    )
    .delete(
      '/database/schemas/:name',
      {
        params: t.Object({ name: t.String() }),
        detail: { summary: 'Delete schema', tags: ['database'] },
      },
      async ({ params: { name }, request, set }) => {
        requireAdminAuth(getCallerAuth(request))
        await (await getService(service, request)).delete(name)
        set.status = 204
      },
    )
}
