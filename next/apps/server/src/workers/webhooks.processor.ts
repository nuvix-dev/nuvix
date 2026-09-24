import { createHmac } from 'node:crypto'
import type { Job } from 'bullmq'

export interface WebhookJobData {
  webhookId: string
  webhookInternalId?: number
  projectId: string
  event: string
  payload: unknown
  url: string
  signatureKey?: string
  security?: boolean
  httpUser?: string | null
  httpPass?: string | null
  attempts?: number
}

export interface WebhookProcessResult {
  success: boolean
  statusCode?: number
  response?: string
}

export default async function processWebhooks(
  job: Job<WebhookJobData>,
): Promise<WebhookProcessResult> {
  const { webhookId, event, payload, url, signatureKey, httpUser, httpPass } = job.data

  if (!url) {
    throw new Error('Webhook URL is required')
  }

  const webhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  }

  const payloadString = JSON.stringify(webhookPayload)
  const secret = signatureKey ?? ''
  const signature = createHmac('sha256', secret).update(payloadString).digest('hex')

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': `sha256=${signature}`,
    'X-Webhook-Event': event,
    'X-Webhook-ID': webhookId,
  }

  if (httpUser && httpPass) {
    headers.Authorization = `Basic ${Buffer.from(`${httpUser}:${httpPass}`).toString('base64')}`
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: payloadString,
    signal: AbortSignal.timeout(10_000),
  })

  const responseBody = await response.text()

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${responseBody.slice(0, 200)}`)
  }

  return {
    success: true,
    statusCode: response.status,
    response: responseBody.slice(0, 1000),
  }
}
