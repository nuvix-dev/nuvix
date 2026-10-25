import { describe, expect, it } from 'bun:test'
import type { ProjectRegistry } from '@nuvix/core/platform'
import type { QueueManager } from '@nuvix/core/queues'
import { createWebhookFanout, eventMatchesPattern, webhookSubscribesToEvent } from './dispatch'

describe('eventMatchesPattern (v1 parity)', () => {
  it('matches wildcards', () => {
    expect(eventMatchesPattern('user.create', '*')).toBe(true)
    expect(eventMatchesPattern('user.create', 'user.*')).toBe(true)
    expect(eventMatchesPattern('user.update.email', 'user.*')).toBe(true)
    expect(eventMatchesPattern('user.create', 'user.create')).toBe(true)
  })

  it('rejects non-matches', () => {
    expect(eventMatchesPattern('user.create', 'team.*')).toBe(false)
    expect(eventMatchesPattern('user.create', '')).toBe(false)
    expect(eventMatchesPattern('', '*')).toBe(false)
    expect(eventMatchesPattern('users.create', 'user.*')).toBe(false)
  })

  it('treats regex metacharacters literally (v1 escaping parity)', () => {
    // v1 escapes `.`, `+`, etc. before expanding `*` — metacharacters in a
    // pattern are LITERAL characters, not regex syntax.
    expect(eventMatchesPattern('CUSTOMlist', 'CUSTOM+list')).toBe(false)
    expect(eventMatchesPattern('CUSTOM+list', 'CUSTOM+list')).toBe(true)
    expect(eventMatchesPattern('CUSTOMXlist', 'CUSTOM.+list')).toBe(false)
    // Wildcard expansion is the only break out of literal matching.
    expect(eventMatchesPattern('CUSTOMXlist', 'CUSTOM*list')).toBe(true)
  })
})

describe('webhookSubscribesToEvent (v1 parity)', () => {
  it('matches any subscribed pattern', () => {
    expect(webhookSubscribesToEvent({ events: ['team.*', 'user.create'] }, 'user.create')).toBe(
      true,
    )
    expect(webhookSubscribesToEvent({ events: ['*'] }, 'anything.at.all')).toBe(true)
    expect(webhookSubscribesToEvent({ events: ['team.*', 'user.create'] }, 'user.delete')).toBe(
      false,
    )
    expect(webhookSubscribesToEvent({ events: [] }, 'user.create')).toBe(false)
  })
})

describe('createWebhookFanout', () => {
  function makeDeps(webhooks: Array<Record<string, unknown>>, calls: unknown[]) {
    const registry = {
      getWebhooks: async () => webhooks,
    } as unknown as ProjectRegistry
    const queues = {
      enqueueWebhook: async (data: unknown, opts?: unknown) => {
        calls.push({ data, opts })
        return 'job_id'
      },
    } as unknown as QueueManager
    return { registry, queues }
  }

  it('enqueues one delivery job per subscribed enabled webhook with v1 retry policy', async () => {
    const calls: unknown[] = []
    const { registry, queues } = makeDeps(
      [
        {
          id: 'hook_star',
          internalId: 11,
          enabled: true,
          events: ['*'],
        },
        {
          id: 'hook_user',
          internalId: 12,
          enabled: true,
          events: ['user.create'],
        },
        {
          id: 'hook_team',
          internalId: 13,
          enabled: true,
          events: ['team.*'],
        },
      ],
      calls,
    )
    const fanout = createWebhookFanout({ registry, queues })

    await fanout('proj_1', 'user.create', { id: 'u_1' })

    expect(calls).toHaveLength(2)
    const first = calls[0] as {
      data: Record<string, unknown>
      opts: Record<string, unknown>
    }
    expect(first.data.webhookId).toBe('hook_star')
    expect(first.data.projectId).toBe('proj_1')
    expect(first.data.event).toBe('user.create')
    expect(first.data.webhookInternalId).toBe(11)
    expect(first.data.attempts).toBe(0)
    // v1 retry policy
    expect(first.opts.attempts).toBe(5)
    expect(first.opts.backoff).toEqual({ type: 'exponential', delay: 1000 })
    expect(first.opts.removeOnComplete).toEqual({ age: 3600 })
    expect(first.opts.removeOnFail).toEqual({ age: 86400 })
  })

  it('skips disabled and unsubscribed webhooks', async () => {
    const calls: unknown[] = []
    const { registry, queues } = makeDeps(
      [
        { id: 'hook_off', enabled: false, events: ['*'] },
        { id: 'hook_team', enabled: true, events: ['team.*'] },
      ],
      calls,
    )
    const fanout = createWebhookFanout({ registry, queues })

    await fanout('proj_1', 'user.create', {})

    expect(calls).toHaveLength(0)
  })

  it('no-ops when no webhooks exist or the registry read fails', async () => {
    const calls: unknown[] = []
    const failing = {
      getWebhooks: async () => {
        throw new Error('db down')
      },
    } as unknown as ProjectRegistry
    const queues = {
      enqueueWebhook: async (data: unknown) => {
        calls.push(data)
        return 'job_id'
      },
    } as unknown as QueueManager

    await fanoutOf(makeDeps([], calls), 'proj_1')
    await createWebhookFanout({ registry: failing, queues })('proj_1', 'user.create', {})

    expect(calls).toHaveLength(0)
  })
})

async function fanoutOf(
  deps: { registry: ProjectRegistry; queues: QueueManager },
  projectId: string,
) {
  return createWebhookFanout(deps)(projectId, 'user.create', {})
}
