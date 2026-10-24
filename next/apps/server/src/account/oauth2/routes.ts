/**
 * OAuth2 routes — `GET /account/sessions/oauth2/:provider` (302 to the
 * provider), `GET|POST /account/sessions/oauth2/:provider/callback` (the
 * login itself), and `GET /account/tokens/oauth2/:provider` (token flow).
 *
 * Callback collapse note (docs/api/account.md): v2 drops v1's separate
 * `redirect` hop — publishable-key routing doesn't need it. The POST form on
 * the callback path exists because Apple posts its profile back
 * (`response_mode: form_post`).
 */

import type { ProjectRegistry } from '@nuvix/core/platform'
import type { Doc, Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import type { Sessions, Users } from '../../types/generated'
import { OAuth2Service } from './service'

export interface OAuth2RouteDeps {
  /** Control-plane registry (provider configs, platforms, auth settings). */
  registry: ProjectRegistry
  /** Base64 platform encryption key — decrypts provider secrets. */
  encryptionKey?: string
}

const redirectQuery = {
  success: t.Optional(
    t.String({
      description: 'URL to redirect to on success (must match a registered project platform)',
    }),
  ),
  failure: t.Optional(
    t.String({
      description: 'URL to redirect to on failure (must match a registered project platform)',
    }),
  ),
}

interface OAuth2RouteContext {
  db: Session
  user: Doc<Users>
  session: Doc<Sessions>
  project: { id: string }
  set: { status?: number; headers: Record<string, string> }
}

function applyRedirect(
  set: { status?: number; headers: Record<string, string> },
  result: {
    location: string
    cookies: string[]
    headers: Record<string, string>
  },
): '' {
  set.status = 302
  for (const [key, value] of Object.entries(result.headers)) {
    set.headers[key] = value
  }
  if (result.cookies.length > 0) {
    set.headers['Set-Cookie'] = result.cookies.join(', ')
  }
  set.headers.Location = result.location
  return ''
}

export const oauth2Routes = (deps: OAuth2RouteDeps) =>
  new Elysia({ name: 'account-oauth2' })
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      user: ('user' in ctx ? ctx.user : undefined) as unknown as Doc<Users>,
      session: ('session' in ctx ? ctx.session : undefined) as unknown as Doc<Sessions>,
    }))

    // 1. Begin OAuth2 session flow → 302 to the provider's authorize URL
    .get(
      '/sessions/oauth2/:provider',
      {
        detail: {
          summary: 'Create OAuth2 session',
          description:
            "Start the OAuth2 login flow for a provider. Responds with a 302 redirect to the provider's authorize URL.",
          tags: ['Account Sessions'],
        },
        params: t.Object({
          provider: t.String({
            description: 'OAuth2 provider key (e.g. google, apple)',
          }),
        }),
        query: t.Object(redirectQuery),
      },
      async (ctx) => {
        const c = ctx as unknown as OAuth2RouteContext
        const service = oauth2Service(c, deps)
        const result = await service.beginSessionFlow({
          provider: (ctx.params as { provider: string }).provider,
          success: (ctx.query as { success?: string }).success,
          failure: (ctx.query as { failure?: string }).failure,
          baseUrl: new URL(ctxRequestUrl(ctx)).origin,
        })
        return applyRedirect(c.set, result)
      },
    )

    // 2. OAuth2 callback — GET (query-string providers) and POST (Apple form_post)
    .get(
      '/sessions/oauth2/:provider/callback',
      {
        detail: {
          summary: 'OAuth2 callback',
          description:
            'Provider callback: exchanges the authorization code, creates or links the account, and redirects to the success URL.',
          tags: ['Account Sessions'],
        },
        params: t.Object({ provider: t.String() }),
        query: callbackParams(),
      },
      (ctx) => runCallback(ctx as unknown as CallbackCtx, deps),
    )
    .post(
      '/sessions/oauth2/:provider/callback',
      {
        detail: {
          summary: 'OAuth2 callback (form post)',
          description: 'Provider callback posted as a form (Apple `response_mode=form_post`).',
          tags: ['Account Sessions'],
        },
        params: t.Object({ provider: t.String() }),
        body: callbackParams(),
      },
      (ctx) => runCallback(ctx as unknown as CallbackCtx, deps),
    )

    // 3. Begin OAuth2 token flow → 302 to the provider
    .get(
      '/tokens/oauth2/:provider',
      {
        detail: {
          summary: 'Create OAuth2 token',
          description:
            'Start the OAuth2 flow that returns userId + secret as query params on the success redirect (for non-cookie clients).',
          tags: ['Account Tokens'],
        },
        params: t.Object({ provider: t.String() }),
        query: t.Object(redirectQuery),
      },
      async (ctx) => {
        const c = ctx as unknown as OAuth2RouteContext
        const service = oauth2Service(c, deps)
        const result = await service.beginTokenFlow({
          provider: (ctx.params as { provider: string }).provider,
          success: (ctx.query as { success?: string }).success,
          failure: (ctx.query as { failure?: string }).failure,
          baseUrl: new URL(ctxRequestUrl(ctx)).origin,
        })
        return applyRedirect(c.set, result)
      },
    )

function callbackParams() {
  return t.Object({
    code: t.Optional(t.String({ description: 'Provider authorization code' })),
    state: t.Optional(t.String({ description: 'Opaque state from the begin step' })),
    error: t.Optional(t.String({ description: 'Provider-reported error code' })),
    error_description: t.Optional(t.String({ description: 'Provider error description' })),
    user: t.Optional(
      t.String({
        description: 'Provider profile blob (Apple first-login form)',
      }),
    ),
  })
}

type CallbackCtx = {
  db: Session
  user: Doc<Users>
  session: Doc<Sessions>
  project: { id: string }
  params: { provider: string }
  query?: Record<string, string | undefined>
  body?: Record<string, string | undefined>
  set: { status?: number; headers: Record<string, string> }
  request: Request
}

async function runCallback(ctx: CallbackCtx, deps: OAuth2RouteDeps) {
  const service = oauth2Service(ctx, deps)
  const params = { ...(ctx.query ?? {}), ...(ctx.body ?? {}) }
  const result = await service.handleCallback({
    provider: ctx.params.provider,
    code: params.code,
    state: params.state,
    error: params.error,
    error_description: params.error_description,
    user: params.user,
    baseUrl: new URL(ctx.request.url).origin,
  })
  return applyRedirect(ctx.set, result)
}

function oauth2Service(
  ctx: Pick<OAuth2RouteContext, 'db' | 'user' | 'session' | 'project'>,
  deps: OAuth2RouteDeps,
): OAuth2Service {
  return new OAuth2Service({
    db: ctx.db,
    registry: deps.registry,
    projectId: ctx.project.id,
    encryptionKey: deps.encryptionKey,
    user: ctx.user,
    currentSession: ctx.session,
  })
}

function ctxRequestUrl(ctx: { request: Request }): string {
  return ctx.request.url
}
