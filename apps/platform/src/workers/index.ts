/** Composes the platform process's queue workers, currently limited to tenant project provisioning. */

import { useBunRedisClients } from '@nuvix/core/queues'
import { QueueFor } from '@nuvix/utils'
import { type ConnectionOptions, Worker } from 'bullmq'
import processProject from './projects.processor'

/** The platform owns project provisioning; project-facing queues are composed by the server app. */
export interface PlatformQueueWorkers {
  projectsWorker: Worker
  close(): Promise<void>
}

/** Build the project-provisioning worker over the supplied Redis connection. */
export function createPlatformQueueWorkers(connection: ConnectionOptions): PlatformQueueWorkers {
  // Bun RedisClient via BullMQ's global factory — ioredis is never loaded.
  useBunRedisClients()
  // In-process handler (not a file path) so the AOT bundle works: BullMQ's
  // file-processor form resolves files on disk at runtime, which breaks when
  // the bundle lives in dist/.
  const projectsWorker = new Worker(QueueFor.PROJECTS, processProject, {
    connection,
    concurrency: 5,
  })

  return {
    projectsWorker,
    async close() {
      // Close the worker before process shutdown so Redis connections and active jobs drain cleanly.
      await projectsWorker.close()
    },
  }
}
