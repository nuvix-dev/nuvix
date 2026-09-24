process.env.NUVIX_PLATFORM_DB_DRIVER ??= 'sqlite'
process.env.NUVIX_PLATFORM_DB_URL ??= ':memory:'
process.env.NUVIX_TENANT_ENCRYPTION_KEY ??= '+xbltPjXL+amkXEHKmIeKvxRQd7YEg6pRt3/PRXSmzo='

import { beforeAll, describe, expect, test } from 'bun:test'
import type { Database } from '@nuvix/db'
import { createPlatformDatabase } from '../../registry/setup'
import { TemplatesService } from './service'

let db: Database
let service: TemplatesService

beforeAll(async () => {
  db = await createPlatformDatabase()
  service = new TemplatesService(db)
})

describe('TemplatesService', () => {
  test('all SMS template methods throw NotImplementedError', async () => {
    await expect(service.getSmsTemplate('proj', 'verification', 'en')).rejects.toThrow(
      'SMS templates not implemented',
    )

    await expect(service.updateSmsTemplate('proj', 'verification', 'en', {})).rejects.toThrow(
      'SMS templates not implemented',
    )

    await expect(service.deleteSmsTemplate('proj', 'verification', 'en')).rejects.toThrow(
      'SMS templates not implemented',
    )
  })

  test('all Email template methods throw NotImplementedError', async () => {
    await expect(service.getEmailTemplate('proj', 'verification', 'en')).rejects.toThrow(
      'Email templates not implemented',
    )

    await expect(service.updateEmailTemplate('proj', 'verification', 'en', {})).rejects.toThrow(
      'Email templates not implemented',
    )

    await expect(service.deleteEmailTemplate('proj', 'verification', 'en')).rejects.toThrow(
      'Email templates not implemented',
    )
  })
})
