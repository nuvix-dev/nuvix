import type { Job } from 'bullmq'

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-nuvix-signature',
  'x-nuvix-timestamp',
  'x-nuvix-nonce',
  'secret',
  'token',
  'apikey',
  'x-nuvix-key',
  'x-nuvix-session',
  'x-nuvix-jwt',
])

export interface ApiLogJobData {
  projectId?: string
  method: string
  path: string
  statusCode: number
  durationMs: number
  ip?: string
  userAgent?: string
  headers?: Record<string, string>
  query?: Record<string, unknown>
  userId?: string
  error?: string
  timestamp?: string
}

function sanitizeHeaders(headers?: Record<string, string>): Record<string, string> {
  if (!headers) return {}
  const sanitized: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase()
    if (
      SENSITIVE_KEYS.has(lowerKey) ||
      lowerKey.includes('token') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('key') ||
      lowerKey.includes('auth') ||
      lowerKey.includes('password')
    ) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

export default async function processLogs(
  job: Job<ApiLogJobData>,
): Promise<{ success: boolean; log: ApiLogJobData }> {
  const data = job.data
  const sanitizedData: ApiLogJobData = {
    ...data,
    headers: sanitizeHeaders(data.headers),
    timestamp: data.timestamp ?? new Date().toISOString(),
  }

  return { success: true, log: sanitizedData }
}
