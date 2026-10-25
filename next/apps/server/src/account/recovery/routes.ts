import type { Session } from '@nuvix/db'
import type { Translator } from '@nuvix/i18n'
import { Elysia, t } from 'elysia'
import type { MailComposer } from '../../mail/composer'
import { auditAfter } from '../../plugins/audit'
import { AccountRecoveryService, type RecoveryDelivery } from './service'

export interface RecoveryRouteDeps {
  /** System-email composer (undefined in test composition → no email). */
  mail?: MailComposer
}

export const accountRecoveryRoutes = ({ mail }: RecoveryRouteDeps = {}) =>
  new Elysia({ name: 'account-recovery' })
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
      project: ('project' in ctx ? ctx.project : undefined) as unknown as
        | { id: string }
        | undefined,
      locale: ('locale' in ctx ? ctx.locale : undefined) as unknown as Translator | undefined,
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
          // Required (v1 parity: `@IsNotEmpty @IsUrl` on CreateRecoveryDTO).
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

/**
 * Composes the per-request delivery deps (capability + translator + platform
 * redirect rules). Returns `undefined` when no composer is configured, so the
 * service can still mint recovery tokens without sending mail (test mode).
 */
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
