import { Elysia } from 'elysia'
import { databaseSchemasRoutes } from './schemas/routes'
import type { SchemaStorage } from './schemas/service'

export const databaseRoutes = (storage?: SchemaStorage) =>
  new Elysia({ prefix: '/database' }).use(databaseSchemasRoutes(storage))
