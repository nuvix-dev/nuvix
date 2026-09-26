import { Elysia } from 'elysia'
import { attributesRoutes } from './attributes/routes'
import type { AttributesService } from './attributes/service'
import { collectionsRoutes } from './collections/routes'
import type { CollectionsService } from './collections/service'
import { documentsRoutes } from './documents/routes'
import type { DocumentsService } from './documents/service'
import { indexesRoutes } from './indexes/routes'
import type { IndexesService } from './indexes/service'
import { publicTablesRoutes, schemaTablesRoutes } from './tables/routes'
import type { TablesService } from './tables/service'

export interface SchemasRouteServices {
  collections?: CollectionsService
  attributes?: AttributesService
  indexes?: IndexesService
  documents?: DocumentsService
  tables?: TablesService
}

export const schemasRoutes = (services?: SchemasRouteServices) => {
  const schemaRoutes = new Elysia({ prefix: '/schemas/:schemaId' })
    .use(collectionsRoutes({ collections: services?.collections }))
    .use(attributesRoutes({ attributes: services?.attributes }))
    .use(indexesRoutes({ indexes: services?.indexes }))
    .use(documentsRoutes({ documents: services?.documents }))
    .use(schemaTablesRoutes({ tables: services?.tables }))

  return new Elysia().use(schemaRoutes).use(publicTablesRoutes({ tables: services?.tables }))
}
