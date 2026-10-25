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
import processStats, { flushStats, setStatsPersister } from './stats.processor'
import processWebhooks, {
  setWebhookStore,
  type WebhookDeliveryLog,
  type WebhookStore,
} from './webhooks.processor'

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

  it('processWebhooks re-reads the record and sends with HMAC-SHA256 signature', async () => {
    let capturedHeaders: Headers | undefined
    let capturedBody: string | undefined
    const logs: WebhookDeliveryLog[] = []

    const store: WebhookStore = {
      read: async (_projectId, webhookId) => ({
        id: webhookId,
        internalId: 42,
        enabled: true,
        url: 'https://example.com/receiver',
        signatureKey: 'supersecretkey',
        security: true,
        httpUser: 'webhookUser',
        httpPass: 'webhookPass',
      }),
      log: async (entry) => {
        logs.push(entry)
      },
    }
    setWebhookStore(store)

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers)
      capturedBody = init?.body as string
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }) as unknown as typeof fetch

    try {
      // v2 job payloads carry ids only — delivery credentials come from the
      // platform record re-read.
      const mockJob = {
        data: {
          webhookId: 'hook_123',
          webhookInternalId: 42,
          projectId: 'proj_456',
          event: 'users.create',
          payload: { userId: 'u_1', name: 'Alice' },
          attempts: 0,
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

      // v1 logDelivery parity: one webhook_logs row on success.
      expect(logs).toHaveLength(1)
      expect(logs[0]!.success).toBe(true)
      expect(logs[0]!.statusCode).toBe(200)
      expect(logs[0]!.webhookInternalId).toBe(42)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('processWebhooks throws on failed HTTP status to trigger BullMQ retry', async () => {
    const logs: WebhookDeliveryLog[] = []
    setWebhookStore({
      read: async (_projectId, webhookId) => ({
        id: webhookId,
        internalId: 7,
        enabled: true,
        url: 'https://example.com/fail',
        signatureKey: undefined,
        security: true,
        httpUser: null,
        httpPass: null,
      }),
      log: async (entry) => {
        logs.push(entry)
      },
    })

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
        },
      } as Job

      await expect(processWebhooks(mockJob)).rejects.toThrow('HTTP 500')

      // v1 logDelivery parity: failure row records the error.
      expect(logs).toHaveLength(1)
      expect(logs[0]!.success).toBe(false)
      expect(String(logs[0]!.error)).toContain('HTTP 500')
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('processWebhooks skips deleted webhooks without retrying (no error thrown)', async () => {
    const logs: WebhookDeliveryLog[] = []
    setWebhookStore({
      read: async () => null,
      log: async (entry) => {
        logs.push(entry)
      },
    })

    const mockJob = {
      data: {
        webhookId: 'hook_gone',
        projectId: 'proj_1',
        event: 'test',
        payload: {},
      },
    } as Job

    const result = await processWebhooks(mockJob)
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
    expect(logs).toHaveLength(0)
  })

  it('processWebhooks skips disabled webhooks without retrying', async () => {
    const logs: WebhookDeliveryLog[] = []
    setWebhookStore({
      read: async (_projectId, webhookId) => ({
        id: webhookId,
        enabled: false,
        url: 'https://example.com/disabled',
        signatureKey: undefined,
        security: true,
        httpUser: null,
        httpPass: null,
      }),
      log: async (entry) => {
        logs.push(entry)
      },
    })

    const mockJob = {
      data: {
        webhookId: 'hook_off',
        projectId: 'proj_1',
        event: 'test',
        payload: {},
      },
    } as Job

    const result = await processWebhooks(mockJob)
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
    expect(logs).toHaveLength(0)
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

  it('processStats buffers metric batches and flushes aggregated rows', async () => {
    const persisted: Array<{
      projectId: string
      metrics: Array<{ key: string; value: number }>
    }> = []
    setStatsPersister(async (projectId, metrics) => {
      persisted.push({ projectId, metrics })
    })

    const mockJob = {
      data: {
        projectId: 'proj_1',
        metrics: [
          { key: 'network.requests', value: 1 },
          { key: 'network.inbound', value: 120 },
          { key: 'network.outbound', value: 340 },
        ],
      },
    } as Job

    const result = await processStats(mockJob)
    expect(result.success).toBe(true)
    expect(result.buffered).toBeGreaterThan(0)

    // Buffered only — nothing persisted before the flush interval.
    expect(persisted).toHaveLength(0)

    await flushStats()
    expect(persisted).toHaveLength(1)
    expect(persisted[0]!.projectId).toBe('proj_1')
    expect(persisted[0]!.metrics).toHaveLength(3)
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
