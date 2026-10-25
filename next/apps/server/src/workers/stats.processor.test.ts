import { describe, expect, it } from 'bun:test'
import type { Doc, Session } from '@nuvix/db'
import { MetricFor, MetricPeriod } from '@nuvix/utils'
import processStats, {
  flushStats,
  formatPeriodDate,
  persistStats,
  setStatsPersister,
} from './stats.processor'

/** Captures createOrUpdateDocumentsWithIncrease calls on a stub session. */
function stubSession() {
  const calls: Array<{
    collection: string
    attribute: string
    rows: Array<Record<string, unknown>>
  }> = []
  const session = {
    createOrUpdateDocumentsWithIncrease: async (
      collection: string,
      attribute: string,
      docs: Doc<Record<string, unknown>>[],
    ) => {
      calls.push({
        collection,
        attribute,
        rows: docs.map((d) => d.toObject() as Record<string, unknown>),
      })
      return docs.length
    },
  }
  return { session: session as unknown as Session, calls }
}

describe('persistStats (v1 StatsQueue.persist parity)', () => {
  it('persists one row per period with deterministic fnv ids', async () => {
    const { session, calls } = stubSession()

    await persistStats(session, [
      { key: MetricFor.USERS, value: 2 },
      { key: MetricFor.REQUESTS, value: 5 },
    ])

    expect(calls).toHaveLength(1)
    const call = calls[0]!
    expect(call.collection).toBe('stats')
    expect(call.attribute).toBe('value')

    // 2 metrics x 3 periods (inf/1h/1d)
    expect(call.rows).toHaveLength(6)

    const periods = new Set(call.rows.map((r) => r.period))
    expect(periods).toEqual(new Set([MetricPeriod.INF, MetricPeriod.HOUR, MetricPeriod.DAY]))

    for (const row of call.rows) {
      expect(String(row.$id)).toMatch(/^[0-9a-f]{32}$/)
      expect(row.metric).toBeTypeOf('string')
      expect(row.region).toBe('local')
      // INF rows carry no time bucket; hour/day rows do.
      if (row.period === MetricPeriod.INF) {
        expect(row.time).toBeNull()
      } else {
        expect(row.time).toBeTypeOf('string')
      }
    }

    // Deterministic ids: same (time, period, metric) → same id.
    const infUserRow = call.rows.find(
      (r) => r.period === MetricPeriod.INF && r.metric === MetricFor.USERS,
    )!
    const infUserRow2 = call.rows.find(
      (r) => r.period === MetricPeriod.INF && r.metric === MetricFor.USERS,
    )!
    expect(infUserRow.$id).toBe(infUserRow2.$id)
  })

  it('aggregates duplicates and skips zero-sum metrics', async () => {
    const { session, calls } = stubSession()

    await persistStats(session, [
      { key: MetricFor.USERS, value: 3 },
      { key: MetricFor.USERS, value: -3 },
      { key: MetricFor.TEAMS, value: 1 },
    ])

    // users +(-3+3)=0 → skipped; teams → 3 period rows.
    expect(calls[0]!.rows).toHaveLength(3)
    expect(calls[0]!.rows.every((r) => r.metric === MetricFor.TEAMS)).toBe(true)
  })

  it('formats period buckets (v1 formatDate parity)', () => {
    const date = new Date('2026-10-25T13:45:12.000Z')
    expect(formatPeriodDate(MetricPeriod.INF, date)).toBe('inf')
    expect(formatPeriodDate(MetricPeriod.HOUR, date)).toBe('2026-10-25T13:00:00Z')
    expect(formatPeriodDate(MetricPeriod.DAY, date)).toBe('2026-10-25T00:00:00Z')
  })
})

describe('processStats batching (v1 AbstractBatchQueue parity)', () => {
  it('buffers jobs per tenant and flushes aggregated metrics', async () => {
    const persisted: Array<{
      projectId: string
      metrics: Array<{ key: string; value: number }>
    }> = []
    setStatsPersister(async (projectId, metrics) => {
      persisted.push({ projectId, metrics })
    })

    await processStats({
      data: {
        projectId: 'proj_1',
        metrics: [{ key: MetricFor.REQUESTS, value: 1 }],
      },
    } as never)
    await processStats({
      data: {
        projectId: 'proj_1',
        metrics: [{ key: MetricFor.REQUESTS, value: 1 }],
      },
    } as never)
    await processStats({
      data: {
        projectId: 'proj_2',
        metrics: [{ key: MetricFor.USERS, value: 2 }],
      },
    } as never)

    // Nothing persisted before the flush interval.
    expect(persisted).toHaveLength(0)

    await flushStats()

    expect(persisted).toHaveLength(2)
    const proj1 = persisted.find((p) => p.projectId === 'proj_1')!
    expect(proj1.metrics).toEqual([
      { key: MetricFor.REQUESTS, value: 1 },
      { key: MetricFor.REQUESTS, value: 1 },
    ])
    const proj2 = persisted.find((p) => p.projectId === 'proj_2')!
    expect(proj2.metrics).toEqual([{ key: MetricFor.USERS, value: 2 }])
  })

  it('keeps the flush loop alive over a failing tenant (requeues)', async () => {
    let fail = true
    const seen: string[] = []
    setStatsPersister(async (projectId, metrics) => {
      if (fail) throw new Error('db down')
      seen.push(`${projectId}:${metrics[0]?.key}`)
    })

    await processStats({
      data: {
        projectId: 'proj_x',
        metrics: [{ key: MetricFor.TEAMS, value: 1 }],
      },
    } as never)
    await flushStats()

    fail = false
    await flushStats()
    expect(seen).toEqual(['proj_x:teams'])
  })
})
