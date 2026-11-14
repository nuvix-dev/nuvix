/** BullMQ worker composition: one worker per queue, plus a shared close boundary. */

import { useBunRedisClients } from '@nuvix/core/queues'
import { QueueFor } from '@nuvix/utils'
import { type ConnectionOptions, Worker } from 'bullmq'
import processAudits from './audits.processor'
import processBatch from './batch.processor'
import processDeletes from './deletes.processor'
import processLogs from './logs.processor'
import processMails from './mails.processor'
import processMessaging from './messaging.processor'
import processStats from './stats.processor'
import processWebhooks from './webhooks.processor'

export { parseRedisUrl } from '@nuvix/core/queues'

/** Handles to every queue worker and a graceful shutdown. */
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

/** Build all queue workers over one Redis connection. */
export function createQueueWorkers(connection: ConnectionOptions): QueueWorkers {
  // Every connection BullMQ creates (workers + blocking duplicates) is a Bun
  // RedisClient — ioredis is never loaded.
  useBunRedisClients()

  const deletesWorker = new Worker(QueueFor.DELETES, processDeletes, {
    connection,
    concurrency: 100,
  })
  const mailsWorker = new Worker(QueueFor.MAILS, processMails, { connection, concurrency: 25 })
  const messagingWorker = new Worker(QueueFor.MESSAGING, processMessaging, {
    connection,
    concurrency: 100,
  })
  const auditsWorker = new Worker(QueueFor.AUDITS, processAudits, { connection, concurrency: 100 })
  const statsWorker = new Worker(QueueFor.STATS, processStats, { connection, concurrency: 10 })
  const webhooksWorker = new Worker(QueueFor.WEBHOOKS, processWebhooks, {
    connection,
    concurrency: 100,
  })
  const logsWorker = new Worker(QueueFor.LOGS, processLogs, { connection, concurrency: 100 })
  const batchWorker = new Worker(QueueFor.BATCH, processBatch, { connection, concurrency: 50 })

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
