/** Mounts database schema operations under one prefix and forwards storage dependencies to the subplugin. */
import { Elysia } from 'elysia'
import { databaseSchemasRoutes } from './schemas/routes'
import type { SchemaStorage } from './schemas/service'

/** Compose database routes with the optional schema storage boundary. */
export const databaseRoutes = (storage?: SchemaStorage) =>
  new Elysia({ prefix: '/database' }).use(databaseSchemasRoutes(storage))
