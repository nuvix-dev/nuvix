/** Listener callback shape; may be sync or async. */
export type EventListener<T = unknown> = (data: T) => void | Promise<void>

/**
 * Type-safe event emitter built on Web standards (zero dependencies).
 * `emit` never awaits listeners and never propagates their errors;
 * `emitAsync` awaits all of them and propagates.
 */
export class TypedEventEmitter<Events extends object = Record<string, unknown>> {
  private listeners = new Map<keyof Events, Set<EventListener<unknown>>>()

  /** Subscribe; returns an unsubscribe function. */
  on<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(listener as unknown as EventListener<unknown>)
    return () => this.off(event, listener)
  }

  /** Subscribe for a single invocation only. */
  once<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): () => void {
    const unsubscribe = this.on(event, async (data) => {
      unsubscribe()
      await listener(data)
    })
    return unsubscribe
  }

  off<K extends keyof Events>(event: K, listener: EventListener<Events[K]>): void {
    const set = this.listeners.get(event)
    if (set) {
      set.delete(listener as unknown as EventListener<unknown>)
      if (set.size === 0) {
        this.listeners.delete(event)
      }
    }
  }

  /** Fire listeners synchronously; async rejections are logged, not thrown. */
  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const set = this.listeners.get(event)
    if (set) {
      for (const rawListener of set) {
        const listener = rawListener as EventListener<Events[K]>
        try {
          const res = listener(data)
          if (res instanceof Promise) {
            res.catch((err) => {
              console.error(`Error in event listener for ${String(event)}:`, err)
            })
          }
        } catch (err) {
          console.error(`Error in event listener for ${String(event)}:`, err)
        }
      }
    }
  }

  /** Fire listeners and await every async one before resolving. */
  async emitAsync<K extends keyof Events>(event: K, data: Events[K]): Promise<void> {
    const set = this.listeners.get(event)
    if (set) {
      const promises: Array<Promise<void>> = []
      for (const rawListener of set) {
        const listener = rawListener as EventListener<Events[K]>
        const res = listener(data)
        if (res instanceof Promise) {
          promises.push(res)
        }
      }
      await Promise.all(promises)
    }
  }

  /** Current subscription count for one event. */
  listenerCount<K extends keyof Events>(event: K): number {
    return this.listeners.get(event)?.size ?? 0
  }

  removeAllListeners(): void {
    this.listeners.clear()
  }
}
