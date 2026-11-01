/**
 * Webhooks worker — delivery half (the fan-out half lives in
 * `../webhooks/dispatch.ts`).
 *
 * Flow:
 *  1. Re-read the webhook from the platform DB before delivering — fresh
 *     URL/signatureKey/Basic auth credentials; disabled/deleted webhooks
 *     are skipped WITHOUT acking retries.
 *  2. Deliver: POST `{event, timestamp, data}`, HMAC-SHA256 signature
 *     header, Basic auth when configured, 10s timeout.
 *  3. Log: one `webhook_logs` row per attempt + webhook `attempts`
 *     counter (reset on success, incremented with a truncated `logs`
 *     error string on failure).
 *
 * Job payloads carry ids only; the record re-read supplies delivery
 * credentials.
 */

import { createHmac } from 'node:crypto'
import type { WebhookJobData } from '@nuvix/core/queues'
import type { Database } from '@nuvix/db'
import { Doc, ID } from '@nuvix/db'
import type { Job } from 'bullmq'

/** Delivery snapshot the send boundary needs (plain record re-read). */
export interface WebhookSnapshot {
  id: string
  internalId?: number
  enabled: boolean
  url: string
  signatureKey?: string
  security: boolean
  httpUser?: string | null
  httpPass?: string | null
}

export interface WebhookDeliveryLog {
  webhookInternalId?: number
  webhookId: string
  success: boolean
  statusCode?: number
  response?: string
  error?: string
}

/** Platform-DB record boundary (overridable in tests). */
export interface WebhookStore {
  read(projectId: string, webhookId: string): Promise<WebhookSnapshot | null>
  log(entry: WebhookDeliveryLog): Promise<void>
}

export interface WebhookProcessResult {
  success: boolean
  /** True when the webhook was missing/disabled — job won't retry. */
  skipped?: boolean
  statusCode?: number
  response?: string
}

/** HTTP delivery boundary (tests stub via global fetch override). */
export type WebhookTransport = (
  url: string,
  init: RequestInit,
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

let transport: WebhookTransport = async (url, init) => {
  const response = await fetch(url, init)
  return response
}

/** Overrides the HTTP delivery boundary (tests). */
export function setWebhookTransport(custom: WebhookTransport): void {
  transport = custom
}

async function defaultRead(_projectId: string, webhookId: string): Promise<WebhookSnapshot | null> {
  const db = await getPlatformDb()
  const webhook = await db.system().getDocument('webhooks', webhookId)
  if (webhook.empty()) return null
  const data = webhook.toObject() as unknown as Record<string, unknown>
  return {
    id: webhook.getId(),
    internalId: webhook.getSequence() ?? undefined,
    enabled: data.enabled === undefined ? true : Boolean(data.enabled),
    url: data.url ? String(data.url) : '',
    signatureKey: data.signatureKey ? String(data.signatureKey) : undefined,
    security: data.security === undefined ? true : Boolean(data.security),
    httpUser: data.httpUser ? String(data.httpUser) : null,
    httpPass: data.httpPass ? String(data.httpPass) : null,
  }
}

/**
 * One `webhook_logs` row per attempt + webhook `attempts` counter:
 * reset on success, increment + truncated error string on failure
 * (response/error capped at 1000 chars).
 */
async function defaultLog(entry: WebhookDeliveryLog): Promise<void> {
  try {
    const db = await getPlatformDb()
    const system = db.system()
    await system.createDocument(
      'webhook_logs',
      new Doc({
        $id: ID.unique(),
        webhookInternalId: entry.webhookInternalId ?? null,
        timestamp: new Date().toISOString(),
        success: entry.success,
        statusCode: entry.statusCode ?? null,
        response: entry.success ? (entry.response ?? '').substring(0, 1000) : null,
        error: entry.error ? entry.error.substring(0, 1000) : null,
      }),
    )

    const webhook = await system.getDocument('webhooks', entry.webhookId)
    if (!webhook.empty()) {
      if (entry.success) {
        webhook.set('attempts', 0) // Reset on success
      } else {
        const currentAttempts = webhook.get('attempts', 0)
        webhook.set('attempts', currentAttempts + 1)
        webhook.set('logs', entry.error?.substring(0, 500) ?? 'Unknown error')
      }
      await system.updateDocument('webhooks', webhook.getId(), webhook)
    }
  } catch {
    // Delivery logging must never fail the job on its own.
  }
}

let dbPromise: Promise<Database> | undefined

/** Memoized platform-DB connection for webhook record reads/logging. */
function getPlatformDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const { createPlatformDatabase } = await import('@nuvix/core/platform')
      const { config } = await import('@nuvix/utils')
      return await createPlatformDatabase({
        driver: config.platform.dbDriver,
        url: config.platform.dbUrl,
        encryptionKey: config.platform.tenantEncryptionKey,
      })
    })()
  }
  return dbPromise
}

let store: WebhookStore = { read: defaultRead, log: defaultLog }

/** Overrides the platform-DB record boundary (tests). */
export function setWebhookStore(custom: WebhookStore): void {
  store = custom
}

/** Entry point wired in `workers/index.ts`. */
export default async function processWebhooks(
  job: Job<WebhookJobData>,
): Promise<WebhookProcessResult> {
  const { webhookId, projectId, event, payload } = job.data

  // Fresh re-read: URL, signature key, Basic auth and enabled state come
  // from the platform record at delivery time.
  const webhook = await store.read(projectId, webhookId)
  if (!webhook) {
    // Deleted → don't retry.
    return { success: true, skipped: true }
  }
  if (!webhook.enabled) {
    return { success: true, skipped: true }
  }

  const internalId = webhook.internalId ?? job.data.webhookInternalId

  try {
    if (!webhook.url) {
      throw new Error('Webhook URL is not set')
    }

    // Prepare payload
    const webhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    }

    const payloadString = JSON.stringify(webhookPayload)
    const secret = webhook.signatureKey ?? ''
    const signature = createHmac('sha256', secret).update(payloadString).digest('hex')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': `sha256=${signature}`,
      'X-Webhook-Event': event,
      'X-Webhook-ID': webhookId,
    }

    if (webhook.httpUser && webhook.httpPass) {
      headers.Authorization = `Basic ${Buffer.from(
        `${webhook.httpUser}:${webhook.httpPass}`,
      ).toString('base64')}`
    }

    const response = await transport(webhook.url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: AbortSignal.timeout(10_000), // 10 second timeout
      ...(webhook.security ? {} : { tls: { rejectUnauthorized: false } }),
    })

    const responseBody = await response.text()

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseBody.slice(0, 200)}`)
    }

    await store.log({
      webhookInternalId: internalId,
      webhookId,
      success: true,
      statusCode: response.status,
      response: responseBody,
    })

    return {
      success: true,
      statusCode: response.status,
      response: responseBody.slice(0, 1000),
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await store.log({
      webhookInternalId: internalId,
      webhookId,
      success: false,
      error: errorMessage,
    })

    // Re-throw to trigger BullMQ retry.
    throw error
  }
}
