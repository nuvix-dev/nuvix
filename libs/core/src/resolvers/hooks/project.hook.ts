import { Injectable, Logger } from '@nestjs/common'
import { Authorization, Database, Doc } from '@nuvix/db'
import ParamsHelper from '../../helpers/params.helper'

import {
  Schemas,
  AUTH_SCHEMA_DB,
  CORE_SCHEMA_DB,
  AUDITS_FOR_PROJECT,
  AppMode,
  Context,
  PROJECT_DB_CLIENT,
  PROJECT_PG,
  DatabaseRole,
} from '@nuvix/utils'
import { Hook } from '../../server/hooks/interface'
import { Exception } from '../../extend/exception'
import { Audit } from '@nuvix/audit'
import { CoreService } from '../../core.service.js'

@Injectable()
export class ProjectHook implements Hook {
  private readonly logger = new Logger(ProjectHook.name)
  private readonly db: Database
  protected dbRole: DatabaseRole = DatabaseRole.ADMIN

  constructor(private readonly coreService: CoreService) {
    this.db = coreService.getPlatformDb()
  }

  async onRequest(req: NuvixRequest) {
    const params = new ParamsHelper(req)
    const projectId =
      params.getFromHeaders('x-nuvix-project') ||
      (req.params as { projectId: string })['projectId'] || // for OAuth2 callback route
      params.getFromQuery('project', 'console')

    if (!projectId || projectId === 'console') {
      req[Context.Project] = new Doc({ $id: 'console' })
      return null
    }

    const project = await Authorization.skip(() =>
      this.db.getDocument('projects', projectId),
    )

    if (!project.empty()) {
      try {
        const client = this.coreService.createMainPool()
        req[PROJECT_DB_CLIENT] = client
        req[PROJECT_PG] = this.coreService.getProjectPg(client)
        const coreDatabase = this.coreService.getProjectDb(client, {
          projectId: project.getId(),
          schema: Schemas.Core,
        })
        const authDatabase = this.coreService.getProjectDb(client, {
          projectId: project.getId(),
          schema: Schemas.Auth,
        })
        req[AUTH_SCHEMA_DB] = authDatabase
        req[CORE_SCHEMA_DB] = coreDatabase
        req[AUDITS_FOR_PROJECT] = new Audit(coreDatabase)
      } catch (e) {
        this.logger.error(
          `Failed to connect to the database for project ${projectId}: `,
          e,
        )
        throw new Exception(
          Exception.GENERAL_SERVER_ERROR,
          'Failed to connect to the project database. Please check your database configuration.',
          500,
        )
      }
    }

    req[Context.Project] = project
    req[Context.Mode] = params.get('mode') || AppMode.DEFAULT
    return null
  }

  // async onResponse(req: NuvixRequest) {
  //   const client: Client = req[PROJECT_DB_CLIENT]
  //   if (client) {
  //     try {
  //       await client.end()

  //       // Clear the reference to prevent potential memory leaks
  //       req[PROJECT_PG] = undefined
  //       req[PROJECT_DB_CLIENT] = undefined
  //       req[AUTH_SCHEMA_DB] = undefined
  //       req[CORE_SCHEMA_DB] = undefined
  //       req[AUDITS_FOR_PROJECT] = undefined
  //     } catch (error) {
  //       this.logger.error('An error occured while ending the client: ', error)
  //     }
  //   }
  // }
}
