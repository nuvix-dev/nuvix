import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { CoreService } from '@nuvix/core'
import { Authorization, Database, Doc, Permission, Role } from '@nuvix/db'
import { Schemas } from '@nuvix/utils'

export async function ensureCoreProvider(
  app: NestFastifyApplication,
  providerId: string,
): Promise<void> {
  const coreService = app.get(CoreService)
  const pool = coreService.createMainPool()
  const db: Database = coreService.getProjectDb(pool, {
    projectId: 'test',
    schema: Schemas.Core,
  })

  await Authorization.skip(async () => {
    const existing = await db.getDocument('providers', providerId)
    if (!existing.empty()) {
      return
    }

    await db.createDocument(
      'providers',
      new Doc({
        $id: providerId,
        $permissions: [Permission.read(Role.any())],
        name: 'Test Provider',
        provider: 'test',
        type: 'push',
        enabled: true,
        credentials: '{}',
        options: {},
        search: 'Test Provider',
      }),
    )
  })
}
