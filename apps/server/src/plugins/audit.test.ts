/** Coverage for audit template mapping, event emission, and sensitive-payload filtering. */
import { describe, expect, it } from 'bun:test'
import {
  auditAfter,
  initInMemoryAuditEmitter,
  mapAuditResource,
  mapAuditTemplateValue,
} from './audit'

describe('audit resource mapping', () => {
  it('maps {res.*} segments from the response', () => {
    expect(mapAuditResource('user/{res.$id}', { response: { $id: 'u1' } })).toBe('user/u1')
  })

  it('maps {user.$id} from the acting user doc shape', () => {
    expect(
      mapAuditResource('user/{user.$id}/session/{res.$id}', {
        response: { $id: 'sess_1' },
        user: { id: 'u9', sequence: 7 },
      }),
    ).toBe('user/u9/session/sess_1')
  })

  it('maps {params.*} and {query.*}', () => {
    expect(
      mapAuditResource('team/{params.teamId}/member/{query.memberId}', {
        params: { teamId: 't1' },
        query: { memberId: 'm1' },
      }),
    ).toBe('team/t1/member/m1')
  })

  it('falls back to Unknown for unmapped segments', () => {
    expect(mapAuditResource('user/{res.$id}', {})).toBe('user/Unknown')
  })

  it('resolves userId templates (undefined when unmapped)', () => {
    expect(mapAuditTemplateValue('{res.userId}', { response: { userId: 'u2' } })).toBe('u2')
    expect(mapAuditTemplateValue('{res.userId}', {})).toBeUndefined()
  })
})

describe('auditAfter hook', () => {
  it('emits a mapped event via the initialized emitter', async () => {
    const { events } = initInMemoryAuditEmitter()
    const hook = auditAfter({
      event: 'user.create',
      resource: 'user/{res.$id}',
    })

    hook({
      request: new Request('http://x/v2/account', {
        headers: { 'user-agent': 'Mozilla/5.0 Chrome/128' },
      }),
      responseValue: { $id: 'u77', email: 'a@b.c', password: 'secret' },
      user: { getId: () => 'u77', getSequence: () => 3, get: () => 'Ada' },
    })

    // Emission is asynchronous; yield once before inspecting the in-memory event list.
    await new Promise((r) => setTimeout(r, 0))

    expect(events).toHaveLength(1)
    const event = events[0]!
    expect(event.event).toBe('user.create')
    expect(event.resource).toBe('user/u77')
    expect(event.userId).toBe('u77')
    expect(event.userSequence).toBe(3)
    expect(event.userAgent).toBe('Mozilla/5.0 Chrome/128')
    // Credentials and other sensitive fields must not enter audit payloads.
    expect(event.data?.password).toBeUndefined()
    expect(event.data?.email).toBe('a@b.c')
  })

  it('never throws on malformed contexts', () => {
    const hook = auditAfter({ event: 'x', resource: 'user/{res.missing}' })
    expect(() =>
      hook({
        request: new Request('http://x/'),
        responseValue: 'weird',
      } as never),
    ).not.toThrow()
  })
})
