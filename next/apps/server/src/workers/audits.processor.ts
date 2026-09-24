import type { Job } from 'bullmq'

export interface AuditJobData {
  event: string
  userId?: string
  resource?: string
  ip?: string
  userAgent?: string
  data?: Record<string, unknown>
}

export default async function processAudits(
  _job: Job<AuditJobData>,
): Promise<{ success: boolean }> {
  // Background audit log writing
  return { success: true }
}
