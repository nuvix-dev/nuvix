import { QueueFor } from '@nuvix/utils'
import { type ConnectionOptions, Worker } from 'bullmq'

export interface QueueWorkers {
  deletesWorker: Worker
  mailsWorker: Worker
  messagingWorker: Worker
  auditsWorker: Worker
  statsWorker: Worker
  webhooksWorker: Worker
  logsWorker: Worker
  batchWorker: Worker
  close(): Promise<void>
}

export function createQueueWorkers(connection: ConnectionOptions): QueueWorkers {
  const deletesWorker = new Worker(
    QueueFor.DELETES,
    new URL('./deletes.processor.ts', import.meta.url).pathname,
    { connection, concurrency: 100 },
  )
  const mailsWorker = new Worker(
    QueueFor.MAILS,
    new URL('./mails.processor.ts', import.meta.url).pathname,
    { connection, concurrency: 25 },
  )
  const messagingWorker = new Worker(
    QueueFor.MESSAGING,
    new URL('./messaging.processor.ts', import.meta.url).pathname,
    { connection, concurrency: 100 },
  )
  const auditsWorker = new Worker(
    QueueFor.AUDITS,
    new URL('./audits.processor.ts', import.meta.url).pathname,
    { connection, concurrency: 100 },
  )
  const statsWorker = new Worker(
    QueueFor.STATS,
    new URL('./stats.processor.ts', import.meta.url).pathname,
    { connection, concurrency: 10 },
  )
  const webhooksWorker = new Worker(
    QueueFor.WEBHOOKS,
    new URL('./webhooks.processor.ts', import.meta.url).pathname,
    { connection, concurrency: 100 },
  )
  const logsWorker = new Worker(
    QueueFor.LOGS,
    new URL('./logs.processor.ts', import.meta.url).pathname,
    { connection, concurrency: 100 },
  )
  const batchWorker = new Worker(
    QueueFor.BATCH,
    new URL('./batch.processor.ts', import.meta.url).pathname,
    { connection, concurrency: 50 },
  )

  return {
    deletesWorker,
    mailsWorker,
    messagingWorker,
    auditsWorker,
    statsWorker,
    webhooksWorker,
    logsWorker,
    batchWorker,
    async close() {
      await Promise.all([
        deletesWorker.close(),
        mailsWorker.close(),
        messagingWorker.close(),
        auditsWorker.close(),
        statsWorker.close(),
        webhooksWorker.close(),
        logsWorker.close(),
        batchWorker.close(),
      ])
    },
  }
}
