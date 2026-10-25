import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { Doc } from '@nuvix/db'
import type { Job } from 'bullmq'
import processAudits from './audits.processor'
import processBatch from './batch.processor'
import processDeletes from './deletes.processor'
import processLogs from './logs.processor'
import processMails, { setMailSender } from './mails.processor'
import processMessaging, { setMessagingSessionResolver } from './messaging.processor'
import processStats from './stats.processor'
import processWebhooks from './webhooks.processor'

describe('Queue Worker Processors', () => {
  it('verifies all processor files exist on disk for BullMQ external workers', () => {
    const files = [
      'audits.processor.ts',
      'batch.processor.ts',
      'deletes.processor.ts',
      'logs.processor.ts',
      'mails.processor.ts',
      'messaging.processor.ts',
      'stats.processor.ts',
      'webhooks.processor.ts',
    ]

    for (const file of files) {
      const path = new URL(`./${file}`, import.meta.url).pathname
      expect(existsSync(path)).toBe(true)
    }
  })

  it('processWebhooks sends webhook payload with HMAC-SHA256 signature', async () => {
    let capturedHeaders: Headers | undefined
    let capturedBody: string | undefined

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers)
      capturedBody = init?.body as string
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as unknown as typeof fetch

    try {
      const mockJob = {
        data: {
          webhookId: 'hook_123',
          projectId: 'proj_456',
          event: 'users.create',
          payload: { userId: 'u_1', name: 'Alice' },
          url: 'https://example.com/receiver',
          signatureKey: 'supersecretkey',
          httpUser: 'webhookUser',
          httpPass: 'webhookPass',
        },
      } as Job

      const result = await processWebhooks(mockJob)

      expect(result.success).toBe(true)
      expect(result.statusCode).toBe(200)
      expect(capturedHeaders?.get('Content-Type')).toBe('application/json')
      expect(capturedHeaders?.get('X-Webhook-Event')).toBe('users.create')
      expect(capturedHeaders?.get('X-Webhook-ID')).toBe('hook_123')
      expect(capturedHeaders?.get('X-Webhook-Signature')).toMatch(/^sha256=[a-f0-9]{64}$/)
      expect(capturedHeaders?.get('Authorization')).toBe(
        `Basic ${Buffer.from('webhookUser:webhookPass').toString('base64')}`,
      )

      const parsedBody = JSON.parse(capturedBody!)
      expect(parsedBody.event).toBe('users.create')
      expect(parsedBody.data).toEqual({ userId: 'u_1', name: 'Alice' })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('processWebhooks throws on failed HTTP status to trigger BullMQ retry', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      return new Response('Server Error', { status: 500 })
    }) as unknown as typeof fetch

    try {
      const mockJob = {
        data: {
          webhookId: 'hook_err',
          projectId: 'proj_1',
          event: 'test',
          payload: {},
          url: 'https://example.com/fail',
        },
      } as Job

      await expect(processWebhooks(mockJob)).rejects.toThrow('HTTP 500')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('processLogs sanitizes sensitive headers and records log data', async () => {
    const mockJob = {
      data: {
        projectId: 'proj_1',
        method: 'POST',
        path: '/v1/account',
        statusCode: 201,
        durationMs: 42,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret_token',
          'x-nuvix-key': 'secret_api_key',
          'User-Agent': 'bun-test',
        },
        userId: 'u_1',
      },
    } as Job

    const result = await processLogs(mockJob)

    expect(result.success).toBe(true)
    expect(result.log.headers?.['Content-Type']).toBe('application/json')
    expect(result.log.headers?.['User-Agent']).toBe('bun-test')
    expect(result.log.headers?.Authorization).toBe('[REDACTED]')
    expect(result.log.headers?.['x-nuvix-key']).toBe('[REDACTED]')
    expect(result.log.timestamp).toBeDefined()
  })

  it('processAudits executes audit log job', async () => {
    const mockJob = {
      data: {
        event: 'users.create',
        userId: 'u_1',
      },
    } as Job

    const result = await processAudits(mockJob)
    expect(result.success).toBe(true)
  })

  it('processDeletes executes cascade delete job', async () => {
    const mockJob = {
      data: {
        document: { $id: 'doc_1' },
        resourceType: 'users',
      },
    } as Job

    const result = await processDeletes(mockJob)
    expect(result.success).toBe(true)
  })

  it('processMails sends via the injected sender and reports results', async () => {
    const sent: string[] = []
    setMailSender(async (params) => {
      sent.push(params.to)
      return 'msg-id-1'
    })

    const mockJob = {
      data: {
        projectId: 'proj_1',
        email: 'user@example.com',
        subject: 'Welcome',
        body: 'Hello world',
        server: {
          host: 'smtp.test',
          port: 587,
          username: 'u',
          password: 'p',
          secure: false,
          senderEmail: 'no-reply@test',
          senderName: 'Test',
          replyTo: '',
        },
      },
    } as Job

    const result = await processMails(mockJob)
    expect(result.status).toBe('success')
    expect(result.sent).toBe(1)
    expect(result.failed).toBe(0)
    expect(sent).toEqual(['user@example.com'])
  })

  it('processMessaging skips when the message is missing (scheduled job)', async () => {
    setMessagingSessionResolver(async () => emptyStubSession() as never)
    const mockJob = {
      data: {
        projectId: 'proj_1',
        message: 'msg_missing',
      },
    } as Job

    const result = await processMessaging(mockJob)
    expect(result.status).toBe('skipped')
  })

  it('processStats executes stat recording job', async () => {
    const mockJob = {
      data: {
        metric: 'requests.count',
        value: 1,
      },
    } as Job

    const result = await processStats(mockJob)
    expect(result.success).toBe(true)
  })

  it('processBatch processes batch items', async () => {
    const mockJob = {
      data: {
        type: 'cleanup',
        items: [{ id: 1 }, { id: 2 }, { id: 3 }],
      },
    } as Job

    const result = await processBatch(mockJob)
    expect(result.success).toBe(true)
    expect(result.processedCount).toBe(3)
    expect(result.failedCount).toBe(0)
  })
})

/** Empty tenant-session stub: every lookup misses. */
function emptyStubSession() {
  const empty = () => new Doc()
  return {
    getDocument: async () => empty(),
    findOne: async () => empty(),
    find: async () => [],
    updateDocument: async (_c: string, _id: string, doc: unknown) => doc,
  }
}
