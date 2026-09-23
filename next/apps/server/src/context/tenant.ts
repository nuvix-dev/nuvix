import type { ResolvedProject } from '@nuvix/core/platform'
import type { TenantResource, TenantResourcePool } from '@nuvix/core/tenants'
import { type Session as DbSession, Role } from '@nuvix/db'
import { Elysia } from 'elysia'
import { SessionsService } from '../modules/sessions/service'
import { HEADERS } from '../shared/constants'
import { BadRequestError, NotFoundError } from '../shared/errors'
import { verifyJwt } from '../utils/jwt'
import { type ProjectContext, type ProjectLookup, resolveProjectContext } from './project'

export interface TenantContext {
  resource?: TenantResource
  /** Caller-scoped session for the default document schema. */
  db?: DbSession
  /** Caller-scoped session for the dedicated auth schema. */
  authSession?: DbSession
  /** Canonical roles resolved for the caller. */
  roles: string[]
}

export interface TenantAuth {
  type: 'guest' | 'session' | 'jwt' | 'apiKey'
  userId?: string
  sessionId?: string
  factors?: string[]
  keyId?: string
  roles: string[]
}

export interface TenantRequestContext {
  tenant: TenantContext
  auth: TenantAuth
  project: ProjectContext
  [key: string]: unknown
}

const requestContextStore = new WeakMap<Request, TenantRequestContext>()

export function getTenantRequestContext(request: Request): TenantRequestContext | undefined {
  return requestContextStore.get(request)
}

export function requireTenantContext(request: Request): {
  tenant: TenantContext
  auth: TenantAuth
  project: ResolvedProject
  authSession: DbSession
  db: DbSession
  resource: TenantResource
} {
  const ctx = requestContextStore.get(request)
  if (!ctx || ctx.project.status === 'absent') {
    throw new BadRequestError('Publishable key is required', {
      code: 'publishable_key_required',
    })
  }
  if (ctx.project.status === 'invalid') {
    throw new NotFoundError('Project', { code: 'project_not_found' })
  }
  if (!ctx.tenant.authSession || !ctx.tenant.db || !ctx.tenant.resource) {
    throw new BadRequestError('Publishable key is required', {
      code: 'publishable_key_required',
    })
  }
  return {
    tenant: ctx.tenant,
    auth: ctx.auth,
    project: ctx.project.project,
    authSession: ctx.tenant.authSession,
    db: ctx.tenant.db,
    resource: ctx.tenant.resource,
  }
}

export async function resolveTenantContext(
  headers: Headers,
  projectContext: ProjectContext,
  pool: TenantResourcePool,
  jwtSecret?: string,
): Promise<TenantRequestContext> {
  if (projectContext.status !== 'resolved') {
    const defaultRoles = [Role.any().toString(), Role.guests().toString()]
    return {
      tenant: { roles: defaultRoles },
      auth: { type: 'guest', roles: defaultRoles },
      project: projectContext,
    }
  }

  const resource = await pool.get(projectContext.project)

  // 1. Session token
  const sessionSecret = headers.get(HEADERS.session)
  if (sessionSecret) {
    const verifierSession = resource.authSession([Role.any().toString()])
    const sessionsService = new SessionsService(verifierSession)
    const verified = await sessionsService.verify(sessionSecret)

    if (verified) {
      const roles = [
        Role.any().toString(),
        Role.users().toString(),
        Role.user(verified.userId).toString(),
      ]

      return {
        tenant: {
          resource,
          db: resource.session(roles),
          authSession: resource.authSession(roles),
          roles,
        },
        auth: {
          type: 'session',
          sessionId: verified.sessionId,
          userId: verified.userId,
          factors: verified.factors,
          roles,
        },
        project: projectContext,
      }
    }
  }

  // 2. Short-lived JWT
  const token = headers.get(HEADERS.jwt)
  if (token && jwtSecret) {
    const payload = await verifyJwt(token, jwtSecret)
    if (payload?.sub) {
      const roles = [
        Role.any().toString(),
        Role.users().toString(),
        Role.user(payload.sub).toString(),
      ]

      return {
        tenant: {
          resource,
          db: resource.session(roles),
          authSession: resource.authSession(roles),
          roles,
        },
        auth: {
          type: 'jwt',
          userId: payload.sub,
          sessionId: typeof payload.sid === 'string' ? payload.sid : undefined,
          roles,
        },
        project: projectContext,
      }
    }
  }

  // 3. Fallback to guest
  const guestRoles = [Role.any().toString(), Role.guests().toString()]
  return {
    tenant: {
      resource,
      db: resource.session(guestRoles),
      authSession: resource.authSession(guestRoles),
      roles: guestRoles,
    },
    auth: {
      type: 'guest',
      roles: guestRoles,
    },
    project: projectContext,
  }
}

export function tenantContext(options: {
  lookup: ProjectLookup
  pool: TenantResourcePool
  jwtSecret?: string
}) {
  return new Elysia({ name: 'tenant-context' }).derive(
    'plugin',
    async ({ request }: { request: Request }) => {
      const project = await resolveProjectContext(request.headers, options.lookup)
      const resolved = await resolveTenantContext(
        request.headers,
        project,
        options.pool,
        options.jwtSecret,
      )
      requestContextStore.set(request, resolved)
      return resolved
    },
  )
}
