/** Provides project-scoped mail capabilities that compose localized messages and enqueue delivery jobs. */

import { type BuiltEmail, EmailHelper, type ProjectMailInfo } from '@nuvix/core/mail'
import { type RedirectRules, redirectRules } from '@nuvix/core/oauth'
import type { ProjectRegistry } from '@nuvix/core/platform'
import type { QueueManager } from '@nuvix/core/queues'
import type { Translator } from '@nuvix/i18n'
import { config } from '@nuvix/utils'

const TEMPLATES_DIR = new URL('../../../../assets/locale/templates', import.meta.url).pathname

export interface MailBuildInput {
  to: string
  /** Inner template file, e.g. `email-inner-base.tpl`. */
  templateFile: string
  /** Locale-scoped template key for custom overrides, e.g. `verification-en`. */
  templateKey: string
  subject: string
  /** Data rendered into the inner template. */
  data: Record<string, unknown>
  /** Variables for the base wrapper (redirect, project, otp, …). */
  variables: Record<string, unknown>
}

/** Narrow mail capability handed to services (undefined → mail disabled). */
export interface MailCapability {
  /** Whether system SMTP is configured for delivery. */
  readonly enabled: boolean
  /** Project display name (async — resolved from the control plane). */
  projectName(): Promise<string>
  build(input: MailBuildInput): Promise<void>
}

/** Per-project capability factory — composition holds the composer. */
export interface MailComposer {
  capabilityFor(projectId: string): MailCapability
  /** Platform redirect rules used to validate links embedded in messages. */
  redirectRulesFor(projectId: string): Promise<RedirectRules>
}

export function createMailComposer(deps: {
  registry: ProjectRegistry
  queues: QueueManager
}): MailComposer {
  return {
    capabilityFor(projectId: string): MailCapability {
      return createMailCapability({ ...deps, projectId })
    },
    async redirectRulesFor(projectId: string): Promise<RedirectRules> {
      const platforms = await deps.registry.getPlatforms(projectId)
      return redirectRules(projectId, platforms)
    },
  }
}

function createMailCapability(deps: {
  registry: ProjectRegistry
  queues: QueueManager
  projectId: string
}): MailCapability {
  const helper = new EmailHelper(TEMPLATES_DIR, {
    host: config.smtp.host,
    port: config.smtp.port,
    user: config.smtp.user,
    password: config.smtp.password,
    secure: config.smtp.secure,
    emailFrom: config.smtp.emailFrom,
    sender: config.smtp.sender,
    replyTo: config.smtp.replyTo,
  })

  const enabled = config.smtp.enabled

  return {
    enabled,
    async build(input: MailBuildInput): Promise<void> {
      const profile = (await deps.registry.getProjectProfile(deps.projectId)) ?? {
        name: 'Nuvix',
      }
      const payload = await buildForProject(helper, profile, input)
      await deps.queues.enqueueMail({
        projectId: deps.projectId,
        email: payload.email,
        subject: payload.subject,
        body: payload.body,
        variables: payload.variables,
        ...(payload.server ? { server: payload.server } : {}),
      })
    },
    async projectName(): Promise<string> {
      const profile = await deps.registry.getProjectProfile(deps.projectId)
      return profile?.name ?? 'Nuvix'
    },
  }
}

/** Composes (but does not send) the payload — exposed for tests. */
export async function buildForProject(
  helper: EmailHelper,
  profile: ProjectMailInfo,
  input: MailBuildInput,
): Promise<BuiltEmail> {
  return helper
    .builder(profile)
    .to(input.to)
    .usingTemplate(input.templateFile, input.templateKey)
    .withSubject(input.subject)
    .withData(input.data)
    .withVariables(input.variables)
    .build()
}

/**
 * Per-request delivery bundle shared by account flows that send mail
 * (recovery, verification, magic URL, OTP): capability + translator +
 * platform redirect rules. Routes compose it from the project context.
 */
export interface MailDelivery {
  mail: MailCapability
  locale: Translator
  rules: RedirectRules
}

/** Capability used when SMTP is unavailable; service methods surface a stable disabled-mail error on use. */
export const disabledMailCapability: MailCapability = {
  enabled: false,
  projectName: async () => 'Nuvix',
  async build() {
    throw new Error('mail_disabled')
  },
}
