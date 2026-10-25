import { beforeAll, describe, expect, it } from 'bun:test'
import type { ProjectMailInfo } from '@nuvix/core/mail'
import { EmailHelper } from '@nuvix/core/mail'
import { type RedirectRules, redirectRules, validateRedirectURL } from '@nuvix/core/oauth'
import type { Session } from '@nuvix/db'
import { Doc, ID, type IEntity } from '@nuvix/db'

/**
 * Mail-flow tests: the composed EmailHelper against real assets templates,
 * redirect-rule validation, and the services' delivery contracts (503 on
 * disabled SMTP, foreign-host redirect rejection).
 */

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

const projectWithSmtp: ProjectMailInfo = {
  name: 'Acme',
  smtp: {
    enabled: true,
    host: 'acme.smtp.test',
    port: 587,
    username: 'acme',
    password: 'pw',
    senderEmail: 'no-reply@acme.test',
    senderName: 'Acme',
  },
}

const helper = new EmailHelper(TEMPLATES_DIR, systemSmtp)

describe('redirect rules', () => {
  let rules: RedirectRules
  beforeAll(() => {
    rules = redirectRules('proj_1', [{ $id: 'p1', type: 'web', hostname: 'app.test' }] as never)
  })

  it('accepts registered hostnames', () => {
    expect(validateRedirectURL('https://app.test/reset', rules)).toBeNull()
  })

  it('rejects foreign hosts with a description', () => {
    expect(validateRedirectURL('https://evil.test/reset', rules)).toBeTruthy()
  })
})

/** Minimal tenant Session stub covering the recovery service's surface. */
function stubSession() {
  const users = new Map<string, Doc>()
  const tokens = new Map<string, Doc>()
  const store: Record<string, Map<string, Doc>> = { users, tokens }
  const getCollection = (name: string) => store[name] ?? new Map<string, Doc>()

  const session = {
    findOne: async (collection: string, queries: Array<Record<string, unknown>>) => {
      const col = getCollection(collection)
      const all = [...col.values()]
      if (queries.length === 0) return all[0] ?? new Doc()
      for (const q of queries) {
        if (q && typeof q === 'object' && 'values' in (q as object)) {
          const values = (q as { values?: unknown[] }).values ?? []
          return all.find((d) => values.includes(d.get('email'))) ?? new Doc()
        }
      }
      return all[0] ?? new Doc()
    },
    find: async (collection: string) => [...getCollection(collection).values()],
    getDocument: async (collection: string, id: string) =>
      getCollection(collection).get(id) ?? new Doc(),
    createDocument: async (collection: string, doc: Doc) => {
      let col = store[collection]
      if (!col) {
        col = new Map()
        store[collection] = col
      }
      const id = doc.getId() || ID.unique()
      doc.set('$id', id)
      col.set(id, doc)
      return doc
    },
    updateDocument: async (collection: string, id: string, doc: Doc) => {
      store[collection]?.set(id, doc)
      return doc
    },
    deleteDocument: async (collection: string, id: string) => {
      store[collection]?.delete(id)
    },
  } as unknown as Session
  return { session, users, tokens }
}

function addUser(users: Map<string, Doc>, email: string) {
  const id = ID.unique()
  const user = new Doc<Partial<IEntity>>({
    $id: id,
    email,
    name: 'Recover Me',
    status: true,
  })
  users.set(id, user)
  return user
}

function delivery(overrides?: Partial<{ enabled: boolean }>) {
  const sent: Array<{ to: string; subject: string; server?: unknown }> = []
  return {
    sent,
    bundle: {
      mail: {
        enabled: overrides?.enabled ?? true,
        projectName: async () => 'Acme',
        build: async (input: { to: string; subject: string }) => {
          sent.push({ to: input.to, subject: input.subject })
        },
      },
      locale: {
        locale: 'en',
        format: (key: string, params?: Record<string, unknown>) =>
          params?.project ? `${key}:${params.project as string}` : key,
      },
      rules: redirectRules('proj_1', [{ $id: 'p1', type: 'web', hostname: 'app.test' }] as never),
    },
  }
}

describe('recovery delivery contract', () => {
  it('sends the recovery email and validates redirects (503/disabled when off)', async () => {
    const { AccountRecoveryService } = await import('../account/recovery/service')
    const { session, users } = stubSession()
    const svc = new AccountRecoveryService(session)
    addUser(users, 'r@example.com')

    const { bundle, sent } = delivery()
    const token = await svc.createRecovery(
      { email: 'r@example.com', url: 'https://app.test/reset' },
      bundle as never,
    )
    expect(token.secret).toBeTruthy()
    expect(sent).toHaveLength(1)
    expect(sent[0]?.to).toBe('r@example.com')

    // disabled SMTP → 503 problem (v1 `general_smtp_disabled` parity)
    const disabled = delivery({ enabled: false })
    expect(async () =>
      svc.createRecovery(
        { email: 'r@example.com', url: 'https://app.test/reset' },
        disabled.bundle as never,
      ),
    ).toThrow()

    // foreign host → rejected
    expect(async () =>
      svc.createRecovery(
        { email: 'r@example.com', url: 'https://evil.test/reset' },
        delivery().bundle as never,
      ),
    ).toThrow()
  })
})

describe('verification payload parity', () => {
  it('builds the verification email off the inner-base template', async () => {
    const built = await helper
      .builder(projectWithSmtp)
      .to('v@example.com')
      .usingTemplate('email-inner-base.tpl', 'verification-en')
      .withSubject('emails.verification.subject')
      .withData({
        hello: 'Hello',
        body: 'Verify to your Acme account.',
        footer: 'f',
        thanks: 't',
        signature: 'Acme',
      })
      .withVariables({
        direction: 'ltr',
        redirect: 'https://app.test/verify?userId=1&secret=2',
        project: 'Acme',
        team: '',
      })
      .build()

    expect(built.subject).toBe('emails.verification.subject')
    expect(built.body).toContain('Verify to your Acme account.')
    expect(built.body).toContain('https://app.test/verify')
    expect(built.server?.senderEmail).toBe('no-reply@acme.test')
  })
})
