import { Injectable } from '@nestjs/common'
import { Database } from '@nuvix/db'
import { CoreService } from '@nuvix/core'
import { Exception } from '@nuvix/core/extend/exception'

@Injectable()
export class MetadataService {
  private readonly db: Database

  constructor(private coreService: CoreService) {
    this.db = this.coreService.getPlatformDb()
  }

  async updateExposedSchemas(projectId: string, schemas: string[]) {
    const project = await this.db.getDocument('projects', projectId)

    if (project.empty()) throw new Exception(Exception.PROJECT_NOT_FOUND)

    const metadata = project.get('metadata')

    project.set('metadata', {
      ...metadata,
      allowedSchemas: schemas,
    })

    await this.db.updateDocument('projects', projectId, project)

    return project
  }
}
