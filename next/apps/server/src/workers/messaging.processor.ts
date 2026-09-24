import type { Job } from 'bullmq'

export interface MessageJobData {
  providerId?: string
  targetId?: string
  messageId?: string
  data?: Record<string, unknown>
}

export default async function processMessaging(
  _job: Job<MessageJobData>,
): Promise<{ success: boolean }> {
  // Background push/sms/email message delivery
  return { success: true }
}
