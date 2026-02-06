import { Injectable } from '@nestjs/common'
import { CoreService } from '@nuvix/core'
import { DataSource } from '@nuvix/pg'
import { Schema, SchemaMeta, Schemas, SchemaType } from '@nuvix/utils'
import type { CollectionsDoc, ProjectsDoc } from '@nuvix/utils/types'
import type { GeneratorQueryDTO } from './DTO/generator.dto'
import type { PostgresMeta } from './lib'
import { getGeneratorMetadata } from './lib/generators'
import { apply as applyTypescriptTemplate } from './templates/typescript'

@Injectable()
export class PgMetaService {
  constructor(private readonly coreService: CoreService) {}

  async generateTypescript(
    client: PostgresMeta,
    query: GeneratorQueryDTO,
    project: ProjectsDoc,
  ): Promise<string> {
    const {
      included_schemas,
      excluded_schemas,
      detect_one_to_one_relationships: detectOneToOneRelationships = false,
    } = query
    const dataSource = new DataSource(client.client)
    const schemas = await dataSource
      .table<Schema>('schemas')
      .withSchema(Schemas.System)
      .select('*')

    const schemasWithCollections: Record<string, CollectionsDoc[]> = {}

    for (const schema of schemas.filter(s => s.type === SchemaType.Document)) {
      const db = this.coreService.getProjectDb(client.client, {
        projectId: project.getId(),
        schema: schema.name,
      })

      const collections = await db.find(SchemaMeta.collections, qb =>
        qb.limit(1000),
      ) // Limit to 1000 collections for performance
      schemasWithCollections[schema.name] = collections
    }

    const { data } = await getGeneratorMetadata(client, {
      includedSchemas: [
        ...schemas.filter(s => s.type !== SchemaType.Document).map(s => s.name),
        ...(included_schemas?.split(',').map(schema => schema.trim()) || []),
      ],
      excludedSchemas:
        excluded_schemas?.split(',').map(schema => schema.trim()) ||
        schemas.filter(s => s.type === SchemaType.Document).map(s => s.name),
    })

    return applyTypescriptTemplate({
      ...data!,
      schemasWithCollections,
      schemasMeta: schemas,
      detectOneToOneRelationships,
    })
  }
}
