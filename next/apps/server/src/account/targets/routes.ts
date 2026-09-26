import type { Doc, Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import type { Sessions, Users } from '../../types/generated'
import { requireAuth } from '../auth'
import { AccountTargetsService } from './service'

export const accountTargetsRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      user: ('user' in ctx ? ctx.user : undefined) as unknown as Doc<Users>,
      session: ('session' in ctx ? ctx.session : undefined) as unknown as Doc<Sessions>,
    }))

    // 34. Create push target
    .post(
      '/targets/push',
      {
        detail: {
          summary: 'Register push target',
          description:
            'Register a device push notification target token for the authenticated user.',
          tags: ['Account Targets'],
        },
        body: t.Object({
          targetId: t.Optional(t.String({ description: 'Custom target ID (optional)' })),
          identifier: t.String({ description: 'Device push notification token (FCM/APNS)' }),
          providerId: t.Optional(t.String({ description: 'Provider ID for messaging routing' })),
          name: t.Optional(t.String({ description: 'User-friendly device name' })),
        }),
      },
      async ({ db, user, session, body }) => {
        const userId = requireAuth(user)
        const service = new AccountTargetsService(db)
        return service.createPushTarget({
          userId,
          sessionId: session?.getId(),
          ...body,
        })
      },
    )

    // 35. Update push target
    .put(
      '/targets/:targetId/push',
      {
        detail: {
          summary: 'Update push target',
          description:
            'Update the push token identifier or name for an existing registered device target.',
          tags: ['Account Targets'],
        },
        params: t.Object({
          targetId: t.String({ description: 'Unique target identifier' }),
        }),
        body: t.Object({
          identifier: t.Optional(
            t.String({ description: 'Updated device push notification token' }),
          ),
          name: t.Optional(t.String({ description: 'Updated device name' })),
        }),
      },
      async ({ db, user, params: { targetId }, body }) => {
        const userId = requireAuth(user)
        const service = new AccountTargetsService(db)
        return service.updatePushTarget({
          userId,
          targetId,
          ...body,
        })
      },
    )

    // 36. Delete push target
    .delete(
      '/targets/:targetId/push',
      {
        detail: {
          summary: 'Delete push target',
          description: 'Remove and unregister a push notification target.',
          tags: ['Account Targets'],
        },
        params: t.Object({
          targetId: t.String({ description: 'Unique target identifier to remove' }),
        }),
        response: {
          200: t.Object({
            status: t.Literal('ok', { description: 'Operation status confirmation' }),
          }),
        },
      },
      async ({ db, user, params: { targetId } }) => {
        const userId = requireAuth(user)
        const service = new AccountTargetsService(db)
        await service.deletePushTarget(userId, targetId)
        return { status: 'ok' as const }
      },
    )
