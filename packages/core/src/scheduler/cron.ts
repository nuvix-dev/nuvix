/**
 * Cron scheduler on top of `Bun.cron` — no external cron dependencies.
 * Tasks are named so they can be cancelled or rescheduled individually.
 */

/** A registered cron task handle. */
export interface ScheduledTask {
  name: string
  schedule: string
  stop(): void
}

/** Registry of named cron tasks; a task's errors are logged, never propagated. */
export class CronScheduler {
  private tasks = new Map<string, ScheduledTask>()

  /** Register (or replace) a named task on a cron expression. */
  schedule(name: string, cronExpression: string, task: () => void | Promise<void>): ScheduledTask {
    if (this.tasks.has(name)) {
      this.cancel(name)
    }

    const job = Bun.cron(cronExpression, async () => {
      try {
        await task()
      } catch (err) {
        console.error(`Scheduled task "${name}" failed:`, err)
      }
    })

    const scheduledTask: ScheduledTask = {
      name,
      schedule: cronExpression,
      stop() {
        job.stop()
      },
    }

    this.tasks.set(name, scheduledTask)
    return scheduledTask
  }

  /** Stop and remove one task; returns whether it existed. */
  cancel(name: string): boolean {
    const task = this.tasks.get(name)
    if (task) {
      task.stop()
      this.tasks.delete(name)
      return true
    }
    return false
  }

  /** Stop and forget every task. */
  cancelAll(): void {
    for (const task of this.tasks.values()) {
      task.stop()
    }
    this.tasks.clear()
  }

  /** Snapshot of registered task names and their expressions. */
  list(): Array<{ name: string; schedule: string }> {
    return Array.from(this.tasks.values()).map(({ name, schedule }) => ({
      name,
      schedule,
    }))
  }
}
