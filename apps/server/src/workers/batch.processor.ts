/** Generic batch worker: iterates queued item batches and reports per-item counts. */
import type { Job } from 'bullmq'

/** A queued batch of items with an optional size hint. */
export interface BatchJobData {
  type: string
  items: Array<Record<string, unknown>>
  batchSize?: number
  options?: Record<string, unknown>
}

/** Per-batch outcome with counts and errors. */
export interface BatchProcessResult {
  success: boolean
  processedCount: number
  failedCount: number
  errors?: string[]
}

/** Entry point wired in `workers/index.ts`. */
export default async function processBatch(job: Job<BatchJobData>): Promise<BatchProcessResult> {
  const { items = [] } = job.data

  let processedCount = 0
  let failedCount = 0
  const errors: string[] = []

  for (const item of items) {
    try {
      if (!item) continue
      processedCount++
    } catch (err) {
      failedCount++
      errors.push(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return {
    success: failedCount === 0,
    processedCount,
    failedCount,
    errors: errors.length > 0 ? errors : undefined,
  }
}
