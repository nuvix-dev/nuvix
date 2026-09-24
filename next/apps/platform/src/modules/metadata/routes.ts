import { Elysia, t } from 'elysia'
import { ProjectSchema } from '../projects/routes'
import type { MetadataService } from './service'

export function metadataRoutes(service: MetadataService) {
  return new Elysia({ name: 'metadata-routes' }).put(
    '/projects/:projectId/metadata/exposed-schemas',
    {
      params: t.Object({ projectId: t.String() }),
      body: t.Object({
        schemas: t.Array(t.String(), { maxItems: 100 }),
      }),
      response: ProjectSchema,
      detail: { summary: 'Update Exposed Schemas', tags: ['metadata'] },
    },
    ({ params, body }) => service.updateExposedSchemas(params.projectId, body.schemas),
  )
}
