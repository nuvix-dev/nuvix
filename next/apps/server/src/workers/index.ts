import { type ConnectionOptions, Worker } from 'bullmq'

export interface QueueWorkers {
  deletesWorker: Worker
  mailsWorker: Worker
  messagingWorker: Worker
  auditsWorker: Worker
  statsWorker: Worker
  close(): Promise<void>
}

export function createQueueWorkers(connection: ConnectionOptions): QueueWorkers {
  const deletesWorker = new Worker(
    'deletes',
    new URL('./deletes.processor.ts', import.meta.url).pathname,
    { connection, concurrency: 100 },
  )
  const mailsWorker = new Worker(
    'mails',
    new URL('./mails.processor.ts', import.meta.url).pathname,
    { connection, concurrency: 25 },
  )
  const messagingWorker = new Worker(
    'messaging',
    new URL('./messaging.processor.ts', import.meta.url).pathname,
    { connection, concurrency: 100 },
  )
  const auditsWorker = new Worker(
    'audits',
    new URL('./audits.processor.ts', import.meta.url).pathname,
    { connection, concurrency: 100 },
  )
  const statsWorker = new Worker(
    'stats',
    new URL('./stats.processor.ts', import.meta.url).pathname,
    { connection, concurrency: 10 },
  )

  return {
    deletesWorker,
    mailsWorker,
    messagingWorker,
    auditsWorker,
    statsWorker,
    async close() {
      await Promise.all([
        deletesWorker.close(),
        mailsWorker.close(),
        messagingWorker.close(),
        auditsWorker.close(),
        statsWorker.close(),
      ])
    },
  }
}
