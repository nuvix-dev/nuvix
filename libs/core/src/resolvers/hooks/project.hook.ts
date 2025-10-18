import { Injectable, Logger } from '@nestjs/common'
import { Authorization, Database, Doc } from '@nuvix/db'
import ParamsHelper from '@nuvix/core/helper/params.helper'

import {
  Schemas,
  AUTH_SCHEMA_DB,
  CORE_SCHEMA_DB,
  AUDITS_FOR_PROJECT,
  AppMode,
  Context,
  PROJECT_DB_CLIENT,
  PROJECT_PG,
  type DatabaseConfig,
  DatabaseRole,
  DEFAULT_DATABASE,
} from '@nuvix/utils'
import { Hook } from '../../server/hooks/interface'
import { Exception } from '@nuvix/core/extend/exception'
import { Client } from 'pg'
import { Audit } from '@nuvix/audit'
import { CoreService } from '@nuvix/core/core.service.js'
import { AppConfigService } from '@nuvix/core/config.service.js'

@Injectable()
export class ProjectHook implements Hook {
  private readonly logger = new Logger(ProjectHook.name)
  private readonly db: Database
  protected dbRole: DatabaseRole = DatabaseRole.ADMIN

  constructor(
    private readonly coreService: CoreService,
    private readonly appConfig: AppConfigService,
  ) {
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
      // we does not support multiple projects
      // so we can update the database information on the fly from environment variables
      project.set('database', {
        pool: {
          host: this.appConfig.getDatabaseConfig().postgres.pool.host,
          port: this.appConfig.getDatabaseConfig().postgres.pool.port,
          password: this.appConfig.getDatabaseConfig().postgres.password,
        },
        postgres: {
          port: this.appConfig.getDatabaseConfig().postgres.port,
          host: this.appConfig.getDatabaseConfig().postgres.host,
          password: this.appConfig.getDatabaseConfig().postgres.password,
        },
      } as unknown as DatabaseConfig)

      try {
        const dbOptions = project.get('database') as unknown as DatabaseConfig
        const client = await this.coreService.createProjectDbClient(
          project.getId(),
          {
            database: DEFAULT_DATABASE,
            user: this.dbRole,
            password:
              this.dbRole === DatabaseRole.ADMIN
                ? this.appConfig.getDatabaseConfig().postgres.adminPassword
                : dbOptions.pool.password,
            port: dbOptions.pool.port || dbOptions.postgres.port,
            host: dbOptions.pool.host,
          },
        )
        client.setMaxListeners(20)
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

  async onResponse(req: NuvixRequest) {
    const client: Client = req[PROJECT_DB_CLIENT]
    if (client) {
      try {
        await client.end()

        // Clear the reference to prevent potential memory leaks
        req[PROJECT_PG] = undefined
        req[PROJECT_DB_CLIENT] = undefined
        req[AUTH_SCHEMA_DB] = undefined
        req[CORE_SCHEMA_DB] = undefined
        req[AUDITS_FOR_PROJECT] = undefined
      } catch (error) {
        this.logger.error('An error occured while ending the client: ', error)
      }
    }
  }
}
