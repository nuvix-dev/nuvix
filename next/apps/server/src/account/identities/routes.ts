import { type Doc, Query, type Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import type { Users } from '../../types/generated'
import { requireAuth } from '../auth'
import { AccountIdentitiesService } from './service'

export const accountIdentitiesRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      user: ('user' in ctx ? ctx.user : undefined) as unknown as Doc<Users>,
    }))

    // 32. List identities
    .get(
      '/identities',
      {
        detail: {
          summary: 'List user identities',
          description:
            'Retrieve OAuth2 and federated identities linked to the authenticated user account.',
          tags: ['Account Identities'],
        },
        query: t.Optional(
          t.Object({
            limit: t.Optional(t.String({ description: 'Number of results to return (max 100)' })),
            offset: t.Optional(t.String({ description: 'Number of results to skip' })),
          }),
        ),
      },
      async ({ db, user, query }) => {
        const userId = requireAuth(user)
        const service = new AccountIdentitiesService(db)
        const queries: Query[] = []
        if (query?.limit) queries.push(Query.limit(Number(query.limit)))
        if (query?.offset) queries.push(Query.offset(Number(query.offset)))
        return service.getIdentities(userId, queries)
      },
    )

    // 33. Delete identity
    .delete(
      '/identities/:identityId',
      {
        detail: {
          summary: 'Unlink identity',
          description:
            'Unlink and delete a federated identity provider connection from the user account.',
          tags: ['Account Identities'],
        },
        params: t.Object({
          identityId: t.String({ description: 'Unique identity connection ID to unlink' }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('ok', { description: 'Operation status confirmation' }),
          }),
        },
      },
      async ({ db, user, params: { identityId } }) => {
        const userId = requireAuth(user)
        const service = new AccountIdentitiesService(db)
        await service.deleteIdentity(userId, identityId)
        return { status: 'ok' as const }
      },
    )
