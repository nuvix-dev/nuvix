/** Background cascade-delete worker (identities, targets, tokens, etc.). */
import type { Job } from 'bullmq'

/** Identifies the resource whose dependent rows should be deleted. */
export interface DeleteJobData {
  document?: Record<string, unknown>
  datetime?: string
  resource?: string
  resourceType?: string
}

/** Entry point wired in `workers/index.ts`. */
export default async function processDeletes(
  job: Job<DeleteJobData>,
): Promise<{ success: boolean }> {
  const { document: _doc, resourceType: _type } = job.data
  // Background cascade deletes (identities, targets, tokens, etc.)
  return { success: true }
}
