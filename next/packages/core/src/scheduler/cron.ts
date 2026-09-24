/**
 * Bun-native cron scheduler using `Bun.cron` (D22).
 * Replaces `@nestjs/schedule` without external cron dependencies.
 */

export interface ScheduledTask {
  name: string
  schedule: string
  stop(): void
}

export class CronScheduler {
  private tasks = new Map<string, ScheduledTask>()

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

  cancel(name: string): boolean {
    const task = this.tasks.get(name)
    if (task) {
      task.stop()
      this.tasks.delete(name)
      return true
    }
    return false
  }

  cancelAll(): void {
    for (const task of this.tasks.values()) {
      task.stop()
    }
    this.tasks.clear()
  }

  list(): Array<{ name: string; schedule: string }> {
    return Array.from(this.tasks.values()).map(({ name, schedule }) => ({
      name,
      schedule,
    }))
  }
}
