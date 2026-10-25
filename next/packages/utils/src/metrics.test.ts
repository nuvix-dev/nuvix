import { describe, expect, it } from 'bun:test'
import { fnv1a128, MetricFor, MetricPeriod } from './metrics'

describe('fnv1a128 (legacy helpers port)', () => {
  it('hashes deterministically to a fixed 32-char hex string', () => {
    const hash = fnv1a128('inf|users')
    expect(hash).toHaveLength(32)
    expect(hash).toMatch(/^[0-9a-f]{32}$/)
    // Deterministic: same input, same hash.
    expect(fnv1a128('inf|users')).toBe(hash)
    // Different inputs hash differently.
    expect(fnv1a128('inf|teams')).not.toBe(hash)
  })

  it('returns the offset basis for the empty string (FNV-1a property)', () => {
    expect(fnv1a128('')).toBe('6c62272e07bb014262b821756295c58d')
  })
})

describe('metric enums (v1 parity)', () => {
  it('carries the v1 metric keys', () => {
    expect(String(MetricFor.USERS)).toBe('users')
    expect(String(MetricFor.SESSIONS)).toBe('sessions')
    expect(String(MetricFor.FILES)).toBe('files')
    expect(String(MetricFor.FILES_STORAGE)).toBe('files.storage')
    expect(String(MetricFor.REQUESTS)).toBe('network.requests')
    expect(String(MetricFor.INBOUND)).toBe('network.inbound')
    expect(String(MetricFor.OUTBOUND)).toBe('network.outbound')
  })

  it('carries the v1 periods', () => {
    expect(String(MetricPeriod.INF)).toBe('inf')
    expect(String(MetricPeriod.HOUR)).toBe('1h')
    expect(String(MetricPeriod.DAY)).toBe('1d')
  })
})
