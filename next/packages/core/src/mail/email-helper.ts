/**
 * Email composition — Bun-native port of legacy
 * `libs/core/src/helpers/email.helper.ts` (EmailHelper + EmailBuilder):
 * renders Handlebars templates from `assets/locale/templates`, resolves the
 * effective SMTP configuration (project override → system default), and
 * applies the project's custom templates (platform templates slice:
 * `templates['email.<key>']` with subject/message/sender overrides).
 *
 * The renderer only BUILDS the payload — delivery happens in the mails
 * worker.
 */

import Handlebars from 'handlebars'

/** Effective SMTP settings for one send (legacy `SmtpConfig`). */
export interface SmtpConfig {
  host: string
  port: number
  username: string
  password: string
  secure: boolean
  senderEmail: string
  senderName: string
  replyTo: string
}

/** Project-scoped data the helper needs (narrow read, see ProjectRegistry). */
export interface ProjectMailInfo {
  name?: string
  smtp?: {
    enabled?: boolean
    host?: string
    port?: number
    username?: string
    password?: string
    secure?: boolean | string
    senderEmail?: string
    senderName?: string
    replyTo?: string
  }
  templates?: Record<string, unknown>
}

export interface SystemSmtp {
  host: string
  port: number
  user: string
  password: string
  secure: boolean
  emailFrom: string
  sender: string
  replyTo: string
}

export interface BuiltEmail {
  email: string
  subject: string
  body: string
  server?: SmtpConfig
  variables: Record<string, unknown>
}

export class EmailHelper {
  readonly #templatesDir: string
  readonly #systemSmtp: SystemSmtp
  readonly #templateCache = new Map<string, HandlebarsTemplateDelegate>()

  constructor(templatesDir: string, systemSmtp: SystemSmtp) {
    this.#templatesDir = templatesDir
    this.#systemSmtp = systemSmtp
  }

  builder(project: ProjectMailInfo): EmailBuilder {
    return EmailBuilder.create(this, project)
  }

  async render(templateFile: string, data: Record<string, unknown>): Promise<string> {
    const compiled = await this.#getCompiledTemplate(templateFile)
    return compiled(data)
  }

  async #getCompiledTemplate(templateFile: string): Promise<HandlebarsTemplateDelegate> {
    const cached = this.#templateCache.get(templateFile)
    if (cached) return cached

    const source = await Bun.file(`${this.#templatesDir}/${templateFile}`).text()
    const compiled = Handlebars.compile(source)
    this.#templateCache.set(templateFile, compiled)
    return compiled
  }

  /**
   * Effective SMTP for a project: the project's own `smtp` record when
   * enabled, falling back to sender identity defaults from the system
   * config (legacy `resolveSmtp` parity).
   */
  resolveSmtp(
    project: ProjectMailInfo,
    customTemplate?: Record<string, unknown> | null,
  ): SmtpConfig | undefined {
    const smtp = project.smtp ?? {}
    const smtpEnabled = smtp.enabled ?? false

    if (!smtpEnabled || !smtp.host) {
      return undefined
    }

    let senderEmail = this.#systemSmtp.emailFrom
    let senderName = this.#systemSmtp.sender
    let replyTo = this.#systemSmtp.replyTo

    if (smtp.senderEmail) senderEmail = smtp.senderEmail
    if (smtp.senderName) senderName = smtp.senderName
    if (smtp.replyTo) replyTo = smtp.replyTo

    if (isRecord(customTemplate)) {
      if (customTemplate.senderEmail) senderEmail = String(customTemplate.senderEmail)
      if (customTemplate.senderName) senderName = String(customTemplate.senderName)
      if (customTemplate.replyTo) replyTo = String(customTemplate.replyTo)
    }

    return {
      host: smtp.host,
      port: smtp.port ?? 587,
      username: smtp.username ?? '',
      password: smtp.password ?? '',
      secure: Boolean(smtp.secure),
      senderEmail,
      senderName,
      replyTo,
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type EmailState = {
  email?: string
  templateFile?: string
  templateKey?: string
  subject?: string
  templateData?: Record<string, unknown>
  variables?: Record<string, unknown>
}

export class EmailBuilder {
  readonly #helper: EmailHelper
  readonly #project: ProjectMailInfo
  readonly #state: EmailState

  private constructor(helper: EmailHelper, project: ProjectMailInfo, state: EmailState) {
    this.#helper = helper
    this.#project = project
    this.#state = state
  }

  static create(helper: EmailHelper, project: ProjectMailInfo): EmailBuilder {
    return new EmailBuilder(helper, project, {})
  }

  to(email: string): EmailBuilder {
    return new EmailBuilder(this.#helper, this.#project, {
      ...this.#state,
      email,
    })
  }

  usingTemplate(file: string, key: string): EmailBuilder {
    return new EmailBuilder(this.#helper, this.#project, {
      ...this.#state,
      templateFile: file,
      templateKey: key,
    })
  }

  withSubject(subject: string): EmailBuilder {
    return new EmailBuilder(this.#helper, this.#project, {
      ...this.#state,
      subject,
    })
  }

  withData(data: Record<string, unknown>): EmailBuilder {
    return new EmailBuilder(this.#helper, this.#project, {
      ...this.#state,
      templateData: data,
    })
  }

  withVariables(variables: Record<string, unknown>): EmailBuilder {
    return new EmailBuilder(this.#helper, this.#project, {
      ...this.#state,
      variables,
    })
  }

  async build(): Promise<BuiltEmail> {
    const { email, templateFile, templateKey, subject, templateData, variables } = this.#state
    if (!email) throw new Error('Email recipient is required')
    if (!templateFile) throw new Error('Email template file is required')
    if (!templateKey) throw new Error('Email template key is required')
    if (!subject) throw new Error('Email subject is required')

    // Custom per-project/per-locale template override (platform templates
    // slice stores them under `email.<templateKey>`).
    const customTemplate = readCustomTemplate(this.#project.templates, templateKey)

    // Variables are merged into the inner render (data wins on conflicts):
    // v1 rendered the inner template with `withData` only, but inner
    // templates reference `{{redirect}}`/`{{user}}` which live in
    // `withVariables` — so v1 shipped EMPTY links in recovery/verification
    // emails. Merging fixes that latent bug.
    const rendered = await this.#helper.render(templateFile, {
      ...(variables ?? {}),
      ...(templateData ?? {}),
    })

    const finalSubject = customTemplate?.subject ?? subject
    const finalBody = customTemplate?.message ?? rendered
    const server = this.#helper.resolveSmtp(this.#project, customTemplate)

    return Object.freeze({
      email,
      subject: finalSubject as string,
      body: finalBody as string,
      ...(server ? { server } : {}),
      variables: variables ?? {},
    }) as BuiltEmail
  }
}

function readCustomTemplate(
  templates: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | null {
  if (!templates) return null
  const raw = templates[`email.${key}`]
  return isRecord(raw) ? raw : null
}
