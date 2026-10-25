/**
 * Webhook dispatch — v2 port of legacy `WebhooksService` fan-out half:
 * matches platform webhooks against domain events and enqueues delivery
 * jobs (BullMQ retries carry the v1 policy — 5 attempts, exponential
 * backoff from 1s).
 *
 * The dispatch boundary is injected via composition (`app.ts`): the request
 * path only sees `fanout(projectId, event, payload)`; the platform webhook
 * registry read happens here against the composed ProjectRegistry.
 */

import type { ProjectRegistry, WebhookInfo } from '@nuvix/core/platform'
import type { QueueManager } from '@nuvix/core/queues'

/**
 * Wildcard-aware event matcher (v1 `eventMatchesPattern` parity):
 * `*` matches everything, `user.*` matches `user.create` etc.; all other
 * regex metacharacters are escaped first.
 */
export function eventMatchesPattern(event: string, pattern: string): boolean {
  if (!pattern || !event) {
    return false
  }

  if (pattern === '*') {
    return true
  }

  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  const regexString = `^${escaped.replace(/\*/g, '.*')}$`
  return new RegExp(regexString).test(event)
}

export function webhookSubscribesToEvent(
  webhook: Pick<WebhookInfo, 'events'>,
  event: string,
): boolean {
  return (webhook.events ?? []).some((pattern) => eventMatchesPattern(event, pattern))
}

/** Limit of webhooks considered per event (guard against runaway fan-out). */
const WEBHOOKS_PER_EVENT_LIMIT = 100

/**
 * Creates the production fan-out: enabled webhooks of the project that
 * subscribe to the event → bulk-enqueued delivery jobs. `httpUser`/
 * `httpPass`/`signatureKey` stay in the webhook record — the worker re-reads
 * it fresh from the platform DB before delivering (v1 parity), so job
 * payloads carry ids only.
 */
export function createWebhookFanout(deps: {
  registry: ProjectRegistry
  queues: QueueManager
}): (projectId: string, event: string, payload: Record<string, unknown>) => Promise<void> {
  return async (projectId, event, payload) => {
    const webhooks = await readWebhooks(deps.registry, projectId, event)
    if (webhooks.length === 0) return

    await Promise.all(
      webhooks.map((webhook) =>
        deps.queues.enqueueWebhook(
          {
            projectId,
            webhookId: webhook.id,
            webhookInternalId: webhook.internalId,
            event,
            payload,
            attempts: 0,
          },
          {
            attempts: 5, // v1 retry policy
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: { age: 3600 },
            removeOnFail: { age: 86400 },
          },
        ),
      ),
    )
  }
}

/**
 * Reads the project's enabled webhooks through the narrow registry
 * boundary and filters by event subscription. Errors are swallowed:
 * webhooks fan-out must never break the request path (v1 listener
 * semantics).
 */
async function readWebhooks(
  registry: ProjectRegistry,
  projectId: string,
  event: string,
): Promise<WebhookInfo[]> {
  try {
    const webhooks = await registry.getWebhooks(projectId)
    return webhooks
      .filter((webhook) => webhook.enabled)
      .filter((webhook) => webhookSubscribesToEvent(webhook, event))
      .slice(0, WEBHOOKS_PER_EVENT_LIMIT)
  } catch {
    return []
  }
}
