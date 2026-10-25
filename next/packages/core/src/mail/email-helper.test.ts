import { beforeAll, describe, expect, it } from 'bun:test'
import { EmailHelper, type ProjectMailInfo } from './email-helper'

const TEMPLATES_DIR = new URL('../../../../assets/locale/templates', import.meta.url).pathname

const systemSmtp = {
  host: 'system.smtp.test',
  port: 587,
  user: 'system',
  password: 'secret',
  secure: false,
  emailFrom: 'no-reply@system.test',
  sender: 'System',
  replyTo: 'support@system.test',
}

const projectSmtp: ProjectMailInfo = {
  name: 'Acme',
  smtp: {
    enabled: true,
    host: 'acme.smtp.test',
    port: 465,
    username: 'acme',
    password: 'hunter2',
    secure: true,
    senderEmail: 'no-reply@acme.test',
    senderName: 'Acme Mailer',
    replyTo: 'help@acme.test',
  },
}

describe('EmailHelper', () => {
  let helper: EmailHelper
  beforeAll(() => {
    helper = new EmailHelper(TEMPLATES_DIR, systemSmtp)
  })

  it('renders a template with data', async () => {
    const html = await helper.render('email-inner-base.tpl', {
      hello: 'Hello',
      body: 'Reset your password',
      redirect: 'https://app.test/reset',
      footer: 'Do not reply',
      thanks: 'Thanks',
      signature: 'Acme',
    })
    expect(html).toContain('Hello')
    expect(html).toContain('https://app.test/reset')
    // raw HTML body must NOT be escaped (triple-stache in template)
    expect(html).toContain('<a href')
  })

  it('builds a payload with project SMTP override', async () => {
    const payload = await helper
      .builder(projectSmtp)
      .to('user@example.com')
      .usingTemplate('email-inner-base.tpl', 'recovery-en')
      .withSubject('Reset')
      .withData({
        hello: 'Hello',
        body: 'Body',
        redirect: 'https://x',
        footer: 'f',
        thanks: 't',
        signature: 's',
      })
      .withVariables({ project: 'Acme' })
      .build()

    expect(payload.email).toBe('user@example.com')
    expect(payload.subject).toBe('Reset')
    expect(payload.server).toEqual({
      host: 'acme.smtp.test',
      port: 465,
      username: 'acme',
      password: 'hunter2',
      secure: true,
      senderEmail: 'no-reply@acme.test',
      senderName: 'Acme Mailer',
      replyTo: 'help@acme.test',
    })
  })

  it('resolves system sender identity when the project has no SMTP', async () => {
    const withoutSmtp: ProjectMailInfo = { name: 'Bare' }
    const server = helper.resolveSmtp(withoutSmtp)
    expect(server).toBeUndefined()
  })

  it('falls back to system sender identity fields', () => {
    const partial: ProjectMailInfo = {
      name: 'Partial',
      smtp: {
        enabled: true,
        host: 'p.smtp.test',
        port: 25,
        username: '',
        password: '',
      },
    }
    const server = helper.resolveSmtp(partial)
    expect(server?.senderEmail).toBe('no-reply@system.test')
    expect(server?.senderName).toBe('System')
    expect(server?.replyTo).toBe('support@system.test')
    expect(server?.host).toBe('p.smtp.test')
  })

  it('applies custom project template overrides (subject/message/sender)', async () => {
    const custom: ProjectMailInfo = {
      name: 'Custom',
      smtp: { enabled: true, host: 'c.smtp.test', port: 25 },
      templates: {
        'email.recovery-en': {
          subject: 'Custom subject',
          message: 'Custom message',
          senderEmail: 'custom@acme.test',
          senderName: 'Custom Sender',
        },
      },
    }
    const payload = await helper
      .builder(custom)
      .to('user@example.com')
      .usingTemplate('email-inner-base.tpl', 'recovery-en')
      .withSubject('Original')
      .withData({})
      .build()

    expect(payload.subject).toBe('Custom subject')
    expect(payload.body).toBe('Custom message')
    expect(payload.server?.senderEmail).toBe('custom@acme.test')
    expect(payload.server?.senderName).toBe('Custom Sender')
  })

  it('rejects payloads missing required fields', async () => {
    expect(async () => {
      await helper.builder(projectSmtp).withSubject('x').withData({}).build()
    }).toThrow('Email recipient is required')
    expect(async () => {
      await helper.builder(projectSmtp).to('u@x.test').withSubject('x').withData({}).build()
    }).toThrow('Email template file is required')
  })

  it('caches compiled templates', async () => {
    const a = await helper.render('email-inner-base.tpl', {})
    const b = await helper.render('email-inner-base.tpl', {})
    expect(a).toBe(b)
  })
})
