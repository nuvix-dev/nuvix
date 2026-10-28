/** Tests for the audits worker: payload normalization and batch flushing. */
import { beforeEach, describe, expect, it } from 'bun:test'
import type { AuditJobData } from './audits.processor'

// The processor keeps module-level state; import fresh helpers each time.
const {
  toAuditRow,
  default: processAudits,
  flushAudits,
  setAuditPersister,
} = await import('./audits.processor')

function makeJob(data: Partial<AuditJobData>): Parameters<typeof processAudits>[0] {
  return {
    data: {
      event: 'user.create',
      projectId: 'proj_1',
      ...data,
    } as AuditJobData,
  } as unknown as Parameters<typeof processAudits>[0]
}

describe('audits processor', () => {
  beforeEach(() => {
    // Drain any state left by earlier tests.
    setAuditPersister(async () => {})
  })

  it('maps job payloads to normalized audit rows', () => {
    const row = toAuditRow({
      event: 'session.create',
      projectId: 'proj_1',
      userSequence: 42,
      userId: 'user_1',
      userName: 'Ada',
      userEmail: 'ada@example.com',
      resource: 'user/user_1',
      ip: '203.0.113.4',
      userAgent: 'Mozilla/5.0',
      mode: 'default',
      data: { provider: 'google' },
    })

    expect(row.projectId).toBe('proj_1')
    expect(row.entry.userId).toBe(42)
    expect(row.entry.event).toBe('session.create')
    expect(row.entry.resource).toBe('user/user_1')
    expect(row.entry.ip).toBe('203.0.113.4')
    expect(row.entry.data).toEqual({
      userId: 'user_1',
      userName: 'Ada',
      userEmail: 'ada@example.com',
      userType: '',
      mode: 'default',
      data: { provider: 'google' },
    })
    expect(row.entry.time).toBeInstanceOf(Date)
  })

  it('defaults guest actors to sequence -1', () => {
    const row = toAuditRow({ event: 'session.create', projectId: 'proj_1' })
    expect(row.entry.userId).toBe(-1)
    expect(row.entry.data.userId).toBe('')
  })

  it('buffers jobs and flushes grouped rows to the persister', async () => {
    const persisted: Array<{ projectId: string; events: string[] }> = []
    setAuditPersister(async (rows) => {
      persisted.push({
        projectId: rows[0]!.projectId,
        events: rows.map((r) => r.entry.event),
      })
    })

    await processAudits(makeJob({ event: 'user.create' }))
    await processAudits(makeJob({ event: 'session.create' }))
    // Different tenant — flushed separately
    await processAudits(makeJob({ event: 'user.delete', projectId: 'proj_2' }))

    await flushAudits()

    expect(persisted).toHaveLength(2)
    const proj1 = persisted.find((p) => p.projectId === 'proj_1')!
    expect(proj1.events).toEqual(['user.create', 'session.create'])
    const proj2 = persisted.find((p) => p.projectId === 'proj_2')!
    expect(proj2.events).toEqual(['user.delete'])
  })
})
