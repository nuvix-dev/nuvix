/**
 * Usage readers for the tenant `stats` collection (auth schema): INF
 * rows carry the running total; period rows (1h/1d) carry the time
 * series, zero-filled across the requested window.
 *
 * The admin routes that expose usage run on the tenant auth-system
 * session (API-key callers), so no permission escape is needed at read
 * time.
 */

import { Query, type Session } from '@nuvix/db'
import { MetricPeriod } from '@nuvix/utils'
import { BadRequestError } from '../shared/errors'
import { formatPeriodDate } from '../workers/stats.processor'

/** Window shape per range: bucket period, number of buckets, and seconds per bucket. */
export const usageConfig = {
  '24h': { period: MetricPeriod.HOUR, limit: 24, factor: 3600 },
  '7d': { period: MetricPeriod.DAY, limit: 7, factor: 86400 },
  '30d': { period: MetricPeriod.DAY, limit: 30, factor: 86400 },
  '90d': { period: MetricPeriod.DAY, limit: 90, factor: 86400 },
} as const

export type UsageRange = keyof typeof usageConfig

/** Validate the `range` query param, defaulting to 30 days. */
export function parseUsageRange(range?: string): UsageRange {
  if (!range || range === '') return '30d'
  if (range in usageConfig) return range as UsageRange
  throw new BadRequestError(`Invalid usage range: ${range}`, {
    code: 'invalid_usage_range',
  })
}

export interface UsageSeries {
  total: number
  data: Array<{ value: number; date: string }>
}

/**
 * Reads INF totals + period-bucketed series for the given metrics,
 * zero-filling the requested window by stepping `limit × factor`
 * seconds from now backwards.
 */
export async function readUsageSeries(
  session: Session,
  metrics: readonly string[],
  range: UsageRange,
): Promise<Record<string, UsageSeries>> {
  const days = usageConfig[range]
  const result: Record<string, UsageSeries> = {}

  for (const metric of metrics) {
    const infRow = await session.findOne('stats', (query) =>
      query.equal('metric', metric).equal('period', MetricPeriod.INF),
    )
    const total = infRow?.get('value') ?? 0

    const rows = await session.find('stats', [
      Query.equal('metric', [metric]),
      Query.equal('period', [days.period]),
      Query.limit(days.limit),
      Query.orderDesc('time'),
    ])

    const byTime = new Map<string, number>()
    for (const row of rows) {
      const time = row.get('time')
      if (!time) continue
      const bucket = formatPeriodDate(days.period, new Date(time as unknown as string))
      byTime.set(bucket, row.get('value') ?? 0)
    }

    // Fill the window with zeros where no bucket row exists.
    const data: Array<{ value: number; date: string }> = []
    const nowSeconds = Math.floor(Date.now() / 1000)
    let leap = nowSeconds - days.limit * days.factor
    while (leap < nowSeconds) {
      leap += days.factor
      const bucket = formatPeriodDate(days.period, new Date(leap * 1000))
      data.push({ value: byTime.get(bucket) ?? 0, date: bucket })
    }

    result[metric] = { total, data }
  }

  return result
}
