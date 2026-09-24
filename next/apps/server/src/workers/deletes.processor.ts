import type { Job } from 'bullmq'

export interface DeleteJobData {
  document?: Record<string, unknown>
  datetime?: string
  resource?: string
  resourceType?: string
}

export default async function processDeletes(
  job: Job<DeleteJobData>,
): Promise<{ success: boolean }> {
  const { document: _doc, resourceType: _type } = job.data
  // Background cascade deletes (identities, targets, tokens, etc.)
  return { success: true }
}
