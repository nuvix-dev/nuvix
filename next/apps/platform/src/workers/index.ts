/** Composes the platform process's queue workers, currently limited to tenant project provisioning. */
import { QueueFor } from '@nuvix/utils'
import { Worker, type WorkerOptions } from 'bullmq'

/** The platform owns project provisioning; project-facing queues are composed by the server app. */
export interface PlatformQueueWorkers {
  projectsWorker: Worker
  close(): Promise<void>
}

/** Build the project-provisioning worker over the supplied Redis connection. */
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
      // Close the worker before process shutdown so Redis connections and active jobs drain cleanly.
      await projectsWorker.close()
    },
  }
}
