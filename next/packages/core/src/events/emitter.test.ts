import { describe, expect, it } from 'bun:test'
import { TypedEventEmitter } from './emitter'

interface TestEvents {
  'user.created': { id: string; email: string }
  'user.deleted': { id: string }
}

describe('TypedEventEmitter', () => {
  it('registers listener and receives event synchronously', () => {
    const emitter = new TypedEventEmitter<TestEvents>()
    let received: { id: string; email: string } | undefined

    emitter.on('user.created', (data) => {
      received = data
    })

    emitter.emit('user.created', { id: 'u1', email: 'u1@example.com' })
    expect(received).toEqual({ id: 'u1', email: 'u1@example.com' })
  })

  it('unsubscribes listener via return function', () => {
    const emitter = new TypedEventEmitter<TestEvents>()
    let count = 0

    const unsub = emitter.on('user.deleted', () => {
      count++
    })

    emitter.emit('user.deleted', { id: 'u1' })
    expect(count).toBe(1)

    unsub()
    emitter.emit('user.deleted', { id: 'u1' })
    expect(count).toBe(1)
  })

  it('handles once listener exactly once', () => {
    const emitter = new TypedEventEmitter<TestEvents>()
    let count = 0

    emitter.once('user.deleted', () => {
      count++
    })

    emitter.emit('user.deleted', { id: 'u1' })
    emitter.emit('user.deleted', { id: 'u2' })
    expect(count).toBe(1)
  })

  it('emitAsync waits for async listeners', async () => {
    const emitter = new TypedEventEmitter<TestEvents>()
    const order: number[] = []

    emitter.on('user.created', async () => {
      await Bun.sleep(10)
      order.push(1)
    })

    emitter.on('user.created', async () => {
      await Bun.sleep(5)
      order.push(2)
    })

    await emitter.emitAsync('user.created', { id: 'u1', email: 'test@example.com' })
    expect(order.length).toBe(2)
  })
})
