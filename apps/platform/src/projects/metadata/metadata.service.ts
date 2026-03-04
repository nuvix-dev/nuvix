import { Injectable } from '@nestjs/common'
import { CoreService } from '@nuvix/core'
import { Exception } from '@nuvix/core/extend/exception'
import { Database } from '@nuvix/db'
import { DataSource } from '@nuvix/pg'
import { Schemas, SchemaType } from '@nuvix/utils'

@Injectable()
export class MetadataService {
  private readonly db: Database
  private readonly dataSource: DataSource

  constructor(private coreService: CoreService) {
    this.db = this.coreService.getInternalDatabase()
    this.dataSource = this.coreService.getDataSourceWithMainPool()
  }

  async updateExposedSchemas(projectId: string, schemas: string[]) {
    const project = await this.db.getDocument('projects', projectId)

    if (project.empty()) {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const metadata = project.get('metadata')
    const availableSchemas = await this.dataSource
      .table('schemas')
      .withSchema(Schemas.System)
      .select('name')
      .whereNot('type', '=', SchemaType.Document)

    if (
      !schemas.every(schema => availableSchemas.some(s => s.name === schema))
    ) {
      throw new Exception(
        Exception.GENERAL_BAD_REQUEST,
        `One or more schemas are not available. Available schemas: ${availableSchemas.map(s => s.name).join(', ')}`,
      )
    }

    project.set('metadata', {
      ...metadata,
      allowedSchemas: schemas,
    })

    await this.db.updateDocument('projects', projectId, project)

    return project
  }
}
