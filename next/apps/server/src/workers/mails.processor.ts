import type { Job } from 'bullmq'

export interface MailJobData {
  to: string
  subject: string
  body?: string
  template?: string
  data?: Record<string, unknown>
}

export default async function processMails(job: Job<MailJobData>): Promise<{ success: boolean }> {
  const { to: _to, subject: _subj } = job.data
  // Background mail sending logic
  return { success: true }
}
