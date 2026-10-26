import { QueueFor } from '@nuvix/utils'
import { Worker, type WorkerOptions } from 'bullmq'

/**
 * Platform queue workers — only PROJECTS runs here (background tenant
 * provisioning). All other queues belong to the project-facing server app.
 * Workers run in-process (main thread) alongside the API.
 */
export interface PlatformQueueWorkers {
  projectsWorker: Worker
  close(): Promise<void>
}

export function createPlatformQueueWorkers(
  connection: WorkerOptions['connection'],
): PlatformQueueWorkers {
  const projectsWorker = new Worker(
    QueueFor.PROJECTS,
    new URL('./projects.processor.ts', import.meta.url).pathname,
    { connection, concurrency: 5 },
  )

  return {
    projectsWorker,
    async close() {
      await projectsWorker.close()
    },
  }
}
