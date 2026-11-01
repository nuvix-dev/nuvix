/** Defines password-recovery initiation and completion endpoints with optional email delivery. */
import type { Session } from '@nuvix/db'
import type { Translator } from '@nuvix/i18n'
import { Elysia, t } from 'elysia'
import type { MailComposer } from '../../mail/composer'
import { auditAfter } from '../../plugins/audit'
import { AccountRecoveryService, type RecoveryDelivery } from './service'

export interface RecoveryRouteDeps {
  /** Optional system-email capability used to deliver recovery instructions. */
  mail?: MailComposer
}

/** Compose recovery routes with request-scoped project, locale, and delivery capabilities. */
export const accountRecoveryRoutes = ({ mail }: RecoveryRouteDeps = {}) =>
  new Elysia({ name: 'account-recovery' })
    // Recovery rules stay in the service; this layer only supplies request context and transport validation.
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      project: ('project' in ctx ? ctx.project : undefined) as unknown as
        | { id: string }
        | undefined,
      locale: ('locale' in ctx ? ctx.locale : undefined) as unknown as Translator | undefined,
    }))

    // Recovery initiation.
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
          url: t.String({
            format: 'uri',
            description: 'Redirect URL callback containing reset token',
          }),
        }),
        afterHandle: auditAfter({
          event: 'recovery.create',
          resource: 'user/{res.userId}',
        }),
      },
      async ({ db, body, locale, project }) => {
        if (!project) {
          throw new Error('publishable-key context missing')
        }
        const service = new AccountRecoveryService(db)
        return service.createRecovery(body, await recoveryDelivery(project.id, mail, locale))
      },
    )

    // Recovery confirmation.
    .put(
      '/recovery',
      {
        detail: {
          summary: 'Complete password recovery',
          description: 'Complete password reset using the token sent via recovery email.',
          tags: ['Account Recovery'],
        },
        body: t.Object({
          userId: t.String({
            description: 'User ID associated with the recovery token',
          }),
          secret: t.String({ description: 'Recovery token secret' }),
          password: t.String({
            minLength: 8,
            description: 'New password for the account',
          }),
        }),
        afterHandle: auditAfter({
          event: 'recovery.update',
          resource: 'user/{res.userId}',
        }),
      },
      async ({ db, body }) => {
        const service = new AccountRecoveryService(db)
        return service.updateRecovery(body)
      },
    )

/** Compose per-request delivery capabilities; absent mail support still allows token creation. */
async function recoveryDelivery(
  projectId: string,
  composer: MailComposer | undefined,
  locale: Translator | undefined,
): Promise<RecoveryDelivery | undefined> {
  if (!composer || !locale) return undefined
  const capability = composer.capabilityFor(projectId)
  const rules = await composer.redirectRulesFor(projectId)
  return { mail: capability, locale, rules }
}
