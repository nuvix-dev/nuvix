/** Composition of the storage subsystem: usage, buckets, and files. */
import { Elysia } from 'elysia'
import { storageBucketsRoutes } from './buckets/routes'
import { storageFilesRoutes } from './files/routes'
import { storageUsageRoutes } from './usage/routes'

/** Compose storage routes. */
export const storageRoutes = () =>
  new Elysia({ prefix: '/storage' })
    .use(storageUsageRoutes())
    .use(storageBucketsRoutes())
    .use(storageFilesRoutes())
