import { Auth } from '@nuvix/core/auth'
import type { ResolvedApiKey, ResolvedProject } from '@nuvix/core/platform'
import type { TenantResource, TenantResourcePool } from '@nuvix/core/tenants'
import { Doc, type Session } from '@nuvix/db'
import { Elysia } from 'elysia'
import { HEADERS } from '../shared/constants'
import { BadRequestError, NotFoundError, UnauthorizedError } from '../shared/errors'
import type { Sessions, Users } from '../types/generated'
import { verifyJwt } from '../utils/jwt'
import type { ProjectLookup } from './project'

export interface KeyLookup {
  resolve(projectId: string, secret: string): Promise<ResolvedApiKey | null>
}

export interface TenantContext {
  [key: string]: unknown
  project: ResolvedProject
  tenantResource: TenantResource
  db: Session
  user: Doc<Users>
  session: Doc<Sessions>
  roles: string[]
  isAPIUser: boolean
  isAdmin: boolean
}

export interface TenantContextOptions {
  projectLookup: ProjectLookup
  tenantPool: TenantResourcePool
  keyLookup?: KeyLookup
  jwtSecret?: string
}

export function parseCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}

export async function resolveTenantContext(
  headers: Headers,
  query: Record<string, string | undefined>,
  options: TenantContextOptions,
): Promise<TenantContext> {
  const publishableKey = headers.get(HEADERS.publishableKey)
  if (!publishableKey) {
    throw new BadRequestError('Publishable key is required', {
      code: 'publishable_key_required',
    })
  }

  const project = await options.projectLookup.resolve(publishableKey)
  if (!project) {
    throw new NotFoundError('Project', { code: 'project_not_found' })
  }

  const tenantResource = await options.tenantPool.get(project)

  // 1. API key authentication (x-nuvix-key header or apikey query param)
  const apiKeyHeader = headers.get(HEADERS.apiKey) || query.apikey || query.apiKey
  let isAPIUser = false
  let isAdmin = false

  if (apiKeyHeader) {
    if (!options.keyLookup) {
      throw new UnauthorizedError('Invalid or expired API key', {
        code: 'user_unauthorized',
      })
    }
    const resolvedKey = await options.keyLookup.resolve(project.id, apiKeyHeader)
    if (!resolvedKey) {
      throw new UnauthorizedError('Invalid or expired API key', {
        code: 'user_unauthorized',
      })
    }

    isAPIUser = true
    isAdmin = true
    const user = new Doc<Users>({})
    const session = new Doc<Sessions>({})
    const roles = Auth.getRoles(user, true, true)
    const db = tenantResource.authSystemSession()
    return {
      project,
      tenantResource,
      db,
      user,
      session,
      roles,
      isAPIUser,
      isAdmin,
    }
  }

  // 2. Session authentication (x-nuvix-session header or cookie)
  let user = new Doc<Users>({})
  let currentSession = new Doc<Sessions>({})
  const sessionHeader = headers.get(HEADERS.session)
  const cookieSession =
    parseCookie(headers.get('cookie'), 'nx_session') ||
    parseCookie(headers.get('cookie'), 'nc_session')
  const rawSession = sessionHeader || cookieSession

  if (rawSession) {
    try {
      const { id: userId, secret } = await Auth.decodeSession(rawSession)
      if (userId && secret) {
        const userDoc = (await tenantResource
          .authSystemSession()
          .getDocument('users', userId)) as Doc<Users>
        if (!userDoc.empty()) {
          const sessions = (userDoc.get('sessions') || []) as Doc<Sessions>[]
          const verifiedSessionId = Auth.sessionVerify(sessions, secret)
          if (verifiedSessionId) {
            user = userDoc
            currentSession =
              sessions.find((s) => s.getId() === verifiedSessionId) || new Doc<Sessions>({})
          }
        }
      }
    } catch {
      // Invalid session token format — falls through to guest
    }
  }

  // 3. JWT authentication (x-nuvix-jwt header)
  const jwtHeader = headers.get(HEADERS.jwt)
  if (jwtHeader && options.jwtSecret && user.empty()) {
    try {
      const payload = await verifyJwt(jwtHeader, options.jwtSecret)
      if (payload?.sub) {
        const userDoc = (await tenantResource
          .authSystemSession()
          .getDocument('users', payload.sub)) as Doc<Users>
        if (!userDoc.empty()) {
          user = userDoc
          if (payload.sid) {
            const sessions = (userDoc.get('sessions') || []) as Doc<Sessions>[]
            currentSession =
              sessions.find((s) => s.getId() === payload.sid) || new Doc<Sessions>({})
          }
        }
      }
    } catch {
      throw new UnauthorizedError('Invalid JWT token', {
        code: 'user_jwt_invalid',
      })
    }
  }

  // 4. Role calculation
  const roles = Auth.getRoles(user, false, false)
  const db = tenantResource.authSession(roles)

  return {
    project,
    tenantResource,
    db,
    user,
    session: currentSession,
    roles,
    isAPIUser,
    isAdmin,
  }
}

export function tenantContext(options: TenantContextOptions) {
  return new Elysia({ name: 'tenant-context' }).derive('plugin', async ({ request, query }) => {
    return resolveTenantContext(
      request.headers,
      (query ?? {}) as Record<string, string | undefined>,
      options,
    )
  })
}
