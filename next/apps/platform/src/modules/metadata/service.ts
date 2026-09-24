import { BadRequestError, NotFoundError } from '@nuvix/core/errors'
import type { Database, Doc } from '@nuvix/db'
import type { Projects } from '../../types/generated'
import { type ProjectView, toView } from '../projects/service'

export class MetadataService {
  constructor(private readonly db: Database) {}

  async updateExposedSchemas(projectId: string, schemas: string[]): Promise<ProjectView> {
    const session = this.db.system()
    const project = (await session.getDocument('projects', projectId)) as Doc<Projects>
    if (project.empty()) {
      throw new NotFoundError('Project', { code: 'project_not_found' })
    }

    if (!Array.isArray(schemas)) {
      throw new BadRequestError('Schemas must be an array', {
        code: 'invalid_schemas',
      })
    }

    const metadata = (project.get('metadata') as Record<string, unknown>) ?? {}
    const updatedMetadata = {
      ...metadata,
      allowedSchemas: schemas,
    }
    project.set('metadata', updatedMetadata)

    const updated = await session.updateDocument('projects', projectId, project)
    return toView(updated as Doc<Projects>)
  }
}
