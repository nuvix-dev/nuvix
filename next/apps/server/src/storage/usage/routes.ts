import type { Session } from '@nuvix/db'
import { Elysia, t } from 'elysia'
import { StorageService } from '../buckets/service'

export const storageUsageRoutes = () =>
  new Elysia()
    .derive('plugin', (ctx) => ({
      db: ('db' in ctx ? ctx.db : undefined) as unknown as Session,
    }))

    // Global storage usage
    .get(
      '/usage',
      {
        detail: {
          summary: 'Get global storage usage',
          description:
            'Retrieve aggregated storage usage metrics, total bucket count, total file count, and storage bytes across the project.',
          tags: ['Storage Usage'],
        },
        query: t.Optional(
          t.Object({
            range: t.Optional(
              t.String({
                description: 'Time window range for usage metrics (e.g. 24h, 7d, 30d, 90d)',
                default: '30d',
              }),
            ),
          }),
        ),
      },
      async ({ db, query }) => {
        const service = new StorageService(db)
        return service.getStorageUsage(query?.range)
      },
    )
