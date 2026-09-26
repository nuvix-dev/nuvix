import type { Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import { AccountRecoveryService } from './service'

export const accountRecoveryRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
    }))

    // 15. Create recovery
    .post(
      '/recovery',
      {
        detail: {
          summary: 'Create password recovery',
          description:
            'Initiate password recovery flow by sending a reset email with secret token.',
          tags: ['Account Recovery'],
        },
        body: t.Object({
          email: t.String({
            format: 'email',
            description: 'User account registered email address',
          }),
          url: t.Optional(
            t.String({
              format: 'uri',
              description: 'Redirect URL callback containing reset token',
            }),
          ),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountRecoveryService(db)
        return service.createRecovery(body)
      },
    )

    // 16. Update recovery (confirm)
    .put(
      '/recovery',
      {
        detail: {
          summary: 'Complete password recovery',
          description: 'Complete password reset using the token sent via recovery email.',
          tags: ['Account Recovery'],
        },
        body: t.Object({
          userId: t.String({ description: 'User ID associated with the recovery token' }),
          secret: t.String({ description: 'Recovery token secret' }),
          password: t.String({ minLength: 8, description: 'New password for the account' }),
        }),
      },
      async ({ db, body }) => {
        const service = new AccountRecoveryService(db)
        return service.updateRecovery(body)
      },
    )
