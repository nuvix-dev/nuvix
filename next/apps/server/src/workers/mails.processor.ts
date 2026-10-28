/**
 * Mails worker: sends system emails (verification, recovery, magic URL,
 * OTP, MFA challenges) over SMTP via the `@nuvix/messaging` SMTP
 * adapter.
 *
 * Pipeline: recipients → transporter (project SMTP override → system
 * config) → base-template render (the inner content is injected as
 * `{{{body}}}`) → send with retry (3 attempts, exponential backoff,
 * permanent-failure short-circuit).
 */

import { config } from '@nuvix/utils'
import type { Job } from 'bullmq'

export interface MailJobData {
  /** Platform project id — resolves the project's SMTP override. */
  projectId: string
  /** Recipient address (single) — bulk sends pass `emails` instead. */
  email?: string
  emails?: string[]
  subject: string
  /** Inner-rendered email content (wrapped by the base template). */
  body: string
  /** Variables for the base wrapper template (project, redirect, otp, …). */
  variables?: Record<string, unknown>
  /** Per-project SMTP override (project record). */
  server?: {
    host: string
    port: number
    username: string
    password: string
    secure: boolean
    senderEmail: string
    senderName: string
    replyTo: string
  }
  /** Base wrapper template path override (absolute). */
  bodyTemplate?: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SEND_RETRY_ATTEMPTS = 3
const SEND_RETRY_DELAY_MS = 500

const TEMPLATES_DIR = new URL('../../../../assets/locale/templates', import.meta.url).pathname
const DEFAULT_BODY_TEMPLATE = `${TEMPLATES_DIR}/email-base-styled.tpl`

/** Injectable send boundary (tests stub this; prod uses the SMTP adapter). */
export type MailSender = (params: {
  transporterParams: {
    host: string
    port: number
    username: string
    password: string
    secure: boolean
  }
  from: { email: string; name: string }
  replyTo: string
  to: string
  subject: string
  html: string
}) => Promise<string | undefined>

let sender: MailSender = defaultSend

/** Overrides the send boundary (tests). */
export function setMailSender(custom: MailSender): void {
  sender = custom
}

async function defaultSend(params: {
  transporterParams: {
    host: string
    port: number
    username: string
    password: string
    secure: boolean
  }
  from: { email: string; name: string }
  replyTo: string
  to: string
  subject: string
  html: string
}): Promise<string | undefined> {
  const { SMTP } = await import('@nuvix/messaging')
  const { Email: EmailMessage } = await import('@nuvix/messaging')
  const p = params.transporterParams
  const adapter = new SMTP(p.host, p.port, p.username, p.password, p.secure)
  const message = new EmailMessage({
    to: [params.to],
    subject: params.subject,
    content: params.html,
    fromName: params.from.name,
    fromEmail: params.from.email,
    replyToEmail: params.replyTo || undefined,
    html: true,
  })
  const result = await adapter.send(message)
  const first = Array.isArray(result) ? result[0] : undefined
  return first?.messageId
}

function resolveRecipients(data: MailJobData): string[] {
  const raw = data.email ? [data.email] : (data.emails ?? [])
  if (raw.length === 0) throw new Error('No recipient emails provided')
  const emails = [...new Set(raw.map((e) => e.trim().toLowerCase()))]
  const invalid = emails.filter((e) => !EMAIL_REGEX.test(e))
  if (invalid.length > 0) {
    throw new Error(`Invalid email addresses: ${invalid.join(', ')}`)
  }
  return emails
}

function resolveTransporterParams(data: MailJobData): {
  host: string
  port: number
  username: string
  password: string
  secure: boolean
} | null {
  if (data.server?.host) {
    return {
      host: data.server.host,
      port: data.server.port ?? 587,
      username: data.server.username ?? '',
      password: data.server.password ?? '',
      secure: Boolean(data.server.secure),
    }
  }
  if (!config.smtp.enabled) return null
  return {
    host: config.smtp.host,
    port: config.smtp.port,
    username: config.smtp.user,
    password: config.smtp.password,
    secure: config.smtp.secure,
  }
}

function resolveFrom(data: MailJobData): { email: string; name: string } {
  if (data.server?.senderEmail) {
    return {
      email: data.server.senderEmail,
      name: data.server.senderName ?? 'Nuvix',
    }
  }
  return {
    email: config.smtp.emailFrom,
    name: data.server?.senderName ?? config.smtp.sender,
  }
}

/** Renders the base wrapper around the inner content. */
async function renderBody(data: MailJobData): Promise<string> {
  const Handlebars = (await import('handlebars')).default
  const path = data.bodyTemplate ?? DEFAULT_BODY_TEMPLATE
  const source = await Bun.file(path).text()
  const compiled = Handlebars.compile(source)
  // The inner-rendered `body` is injected into the wrapper alongside
  // the wrapper variables.
  return compiled({
    ...(data.variables ?? {}),
    body: data.body,
    subject: data.subject,
    year: new Date().getFullYear(),
  })
}

function isPermanentFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /\b(5\d\d|550|551|553|554)\b/.test(message)
}

async function sendWithRetry(params: {
  transporterParams: {
    host: string
    port: number
    username: string
    password: string
    secure: boolean
  }
  from: { email: string; name: string }
  replyTo: string
  to: string
  subject: string
  html: string
}): Promise<string | undefined> {
  let lastError: unknown
  for (let attempt = 1; attempt <= SEND_RETRY_ATTEMPTS; attempt++) {
    try {
      return await sender(params)
    } catch (error) {
      lastError = error
      if (isPermanentFailure(error)) throw error
      if (attempt < SEND_RETRY_ATTEMPTS) {
        const delay = SEND_RETRY_DELAY_MS * 2 ** (attempt - 1)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}

/** Entry point wired in `workers/index.ts`. */
export default async function processMails(
  job: Job<MailJobData>,
): Promise<{ status: 'success' | 'partial'; sent: number; failed: number }> {
  const { subject } = job.data
  if (!subject?.trim()) throw new Error('Email subject is required and cannot be empty')
  if (!job.data.body?.trim()) throw new Error('Email body is required and cannot be empty')

  const transporterParams = resolveTransporterParams(job.data)
  if (!transporterParams) {
    throw new Error(
      'SMTP configuration missing: no default SMTP and no project server override provided',
    )
  }

  const emails = resolveRecipients(job.data)
  const from = resolveFrom(job.data)
  const replyTo = job.data.server?.replyTo ?? ''
  const html = await renderBody(job.data)

  let sent = 0
  let failed = 0
  let firstError: unknown

  for (const email of emails) {
    try {
      await sendWithRetry({
        transporterParams,
        from,
        replyTo,
        to: email,
        subject,
        html,
      })
      sent++
    } catch (error) {
      failed++
      firstError ??= error
      console.error(`[mails] failed to send to ${email}:`, error)
    }
  }

  if (failed > 0 && sent === 0) {
    throw firstError instanceof Error
      ? firstError
      : new Error(`All ${failed} emails failed to send`)
  }

  return { status: failed === 0 ? 'success' : 'partial', sent, failed }
}
