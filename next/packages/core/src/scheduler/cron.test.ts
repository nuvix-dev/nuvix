import { describe, expect, it } from 'bun:test'
import { CronScheduler } from './cron'

describe('CronScheduler', () => {
  it('schedules, lists, and cancels jobs', () => {
    const scheduler = new CronScheduler()

    const task = scheduler.schedule('test-job', '0 * * * *', () => {})
    expect(task.name).toBe('test-job')
    expect(task.schedule).toBe('0 * * * *')

    const list = scheduler.list()
    expect(list.length).toBe(1)
    expect(list[0]?.name).toBe('test-job')

    const cancelled = scheduler.cancel('test-job')
    expect(cancelled).toBe(true)
    expect(scheduler.list().length).toBe(0)
  })

  it('cancelAll stops and clears all scheduled jobs', () => {
    const scheduler = new CronScheduler()

    scheduler.schedule('job-1', '0 * * * *', () => {})
    scheduler.schedule('job-2', '*/5 * * * *', () => {})

    expect(scheduler.list().length).toBe(2)

    scheduler.cancelAll()
    expect(scheduler.list().length).toBe(0)
  })
})
