import { describe, expect, it } from 'bun:test'
import { Doc, type Session } from '@nuvix/db'
import { MetricFor, MetricPeriod } from '@nuvix/utils'
import { parseUsageRange, readUsageSeries } from './usage'

describe('parseUsageRange (legacy RangeQueryDTO parity)', () => {
  it('accepts the documented ranges and defaults to 30d', () => {
    expect(parseUsageRange(undefined)).toBe('30d')
    expect(parseUsageRange('')).toBe('30d')
    expect(parseUsageRange('24h')).toBe('24h')
    expect(parseUsageRange('7d')).toBe('7d')
    expect(parseUsageRange('30d')).toBe('30d')
    expect(parseUsageRange('90d')).toBe('90d')
  })

  it('rejects unknown ranges (v1 DTO @IsIn parity)', () => {
    expect(() => parseUsageRange('1d')).toThrow() // v1 default '1d' was itself invalid!
    expect(() => parseUsageRange('forever')).toThrow()
  })
})

describe('readUsageSeries (v1 getUsage reads parity)', () => {
  function statsSession(inf: Record<string, number>, dayRows: Doc[]) {
    return {
      findOne: async (
        _collection: string,
        query: (qb: { equal: (a: string, v: unknown) => unknown }) => unknown,
      ) => {
        const builder = {
          metric: undefined as string | undefined,
          period: undefined as string | undefined,
          equal(a: string, v: unknown) {
            if (a === 'metric') this.metric = v as string
            if (a === 'period') this.period = v as string
            return this
          },
        }
        query(builder as never)
        if (builder.metric && builder.period === MetricPeriod.INF) {
          const value = inf[builder.metric]
          return value === undefined
            ? new Doc({})
            : new Doc({
                $id: 'inf',
                metric: builder.metric,
                period: 'inf',
                value,
              })
        }
        return new Doc({})
      },
      find: async (_collection: string, queries: unknown[] = []) => {
        const metric = (queries[0] as { values?: string[] })?.values?.[0]
        return dayRows.filter((r) => r.get('metric') === metric)
      },
    } as unknown as Session
  }

  it('reads INF totals and zero-fills the window', async () => {
    const session = statsSession({ [MetricFor.USERS]: 42 }, [
      new Doc<Record<string, unknown>>({
        $id: 'r1',
        metric: MetricFor.USERS,
        period: '1d',
        time: '2026-10-24T00:00:00Z',
        value: 6,
      }),
    ])

    const usage = await readUsageSeries(session, [MetricFor.USERS, MetricFor.SESSIONS], '30d')

    expect(usage[MetricFor.USERS]!.total).toBe(42)
    expect(usage[MetricFor.USERS]!.data).toHaveLength(30)
    // Seeded bucket present; the rest zeros.
    const seeded = usage[MetricFor.USERS]!.data.find((d) => d.value === 6)
    expect(seeded?.date).toBe('2026-10-24T00:00:00Z')
    expect(usage[MetricFor.USERS]!.data.filter((d) => d.value === 0)).toHaveLength(29)

    // Missing metric: total 0, zero-filled series.
    expect(usage[MetricFor.SESSIONS]!.total).toBe(0)
    expect(usage[MetricFor.SESSIONS]!.data).toHaveLength(30)
  })

  it('buckets hourly ranges (24h)', async () => {
    const session = statsSession({}, [])
    const usage = await readUsageSeries(session, [MetricFor.REQUESTS], '24h')
    expect(usage[MetricFor.REQUESTS]!.data).toHaveLength(24)
    for (const point of usage[MetricFor.REQUESTS]!.data) {
      expect(point.date).toMatch(/T\d{2}:00:00Z$/)
    }
  })
})
