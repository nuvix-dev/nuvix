import { Injectable } from '@nestjs/common'
import { DataSource, Context as DataSourceContext } from '@nuvix/pg'
import { Exception } from '../../extend/exception'
import { Hook } from '../../server'
import {
  AppMode,
  Context,
  CURRENT_SCHEMA_DB,
  CURRENT_SCHEMA_PG,
  DatabaseRole,
  PROJECT_DB_CLIENT,
  PROJECT_PG,
  Schemas,
  SchemaType,
  type Schema,
} from '@nuvix/utils'
import type { ProjectsDoc, UsersDoc } from '@nuvix/utils/types'
import { CoreService } from '../../core.service.js'
import type { Client } from 'pg'
import { Auth } from '../../helper'

@Injectable()
export class SchemaHook implements Hook {
  constructor(private readonly coreService: CoreService) {}

  async preHandler(request: NuvixRequest) {
    const project = request[Context.Project] as ProjectsDoc
    if (project.empty() || project.getId() === 'console') {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }
    const user: UsersDoc = request[Context.User]
    const mode: AppMode = request[Context.Mode]
    let role = DatabaseRole.POSTGRES
    const client = request[PROJECT_DB_CLIENT] as Client
    const pg = request[PROJECT_PG] as DataSource

    if (user.empty()) {
      role = DatabaseRole.ANON
    } else {
      role = DatabaseRole.AUTHENTICATED
    }

    const schemaId =
      (request.params as { schemaId: string | undefined }).schemaId || 'public'

    if (schemaId === undefined) return
    const schema = await pg
      .table<Schema>('schemas')
      .withSchema(Schemas.System)
      .where('name', schemaId)
      .first()

    if (schema) {
      request[Context.CurrentSchema] = schema
      if (!Auth.isTrustedActor) {
        if (!schema.enabled) {
          throw new Exception(Exception.SCHEMA_NOT_FOUND)
        }
        const allowed = project.get('metadata')?.['allowedSchemas'] ?? []
        // May be we will add Document schema too in future
        if (
          !allowed.includes(schema.name) &&
          schema.type !== SchemaType.Document
        ) {
          throw new Exception(
            Exception.GENERAL_ACCESS_FORBIDDEN,
            `Access denied: Schema '${schema.name}' is not exposed to the API for this project`,
          )
        }
      }

      const pg = this.coreService.getProjectPg(
        client,
        new DataSourceContext({
          schema: schema.name,
        }),
      )
      request[CURRENT_SCHEMA_PG] = pg

      if (schema.type === SchemaType.Document) {
        const db = this.coreService.getProjectDb(client, {
          projectId: project.getId(),
          schema: schema.name,
        })
        request[CURRENT_SCHEMA_DB] = db
      } else {
        if (mode !== AppMode.ADMIN || !Auth.isPlatformActor) {
          request[Context.AuthMeta] = {
            ...(request[Context.AuthMeta] || {}),
            role,
          }
        }
      }
    } else {
      throw new Exception(Exception.SCHEMA_NOT_FOUND)
    }

    return null
  }
}
