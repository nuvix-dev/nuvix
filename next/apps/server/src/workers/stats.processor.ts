import type { Job } from 'bullmq'

export interface StatJobData {
  metric: string
  value: number
  period?: string
  timestamp?: string
}

export default async function processStats(_job: Job<StatJobData>): Promise<{ success: boolean }> {
  // Background stats metrics recording
  return { success: true }
}
