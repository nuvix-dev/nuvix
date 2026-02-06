import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Audit } from '@nuvix/audit'
import { Database, Doc } from '@nuvix/db'
import { DataSource } from '@nuvix/pg'
import {
  AUDITS_FOR_PROJECT,
  AUTH_SCHEMA_DB,
  CORE_SCHEMA_DB,
  Context,
  CURRENT_SCHEMA_DB,
  CURRENT_SCHEMA_PG,
  PROJECT_PG,
} from '@nuvix/utils'
import { ProjectsDoc } from '@nuvix/utils/types'
import { Exception } from '../extend/exception'

/**
 * Get the current project from the request
 */
export const Project = createParamDecorator<ProjectsDoc>(
  (_data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()

    const project = request[Context.Project] as ProjectsDoc

    if (project.empty() || project.getId() === 'console') {
      return new Doc()
    }
    return project
  },
)

/**
 * Get the core database instance from the request
 */
export const ProjectDatabase = createParamDecorator<any, Database>(
  (_data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()
    const database = request[CORE_SCHEMA_DB] as Database
    return database
  },
)

/**
 * Get the auth database instance from the request
 */
export const AuthDatabase = createParamDecorator<any, Database>(
  (_data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()
    const database = request[AUTH_SCHEMA_DB] as Database
    return database
  },
)

/**
 * Get the current database instance from the request, (the one that corresponds to the requested schema)
 */
export const CurrentDatabase = createParamDecorator<any, Database>(
  (_data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()
    const database = request[CURRENT_SCHEMA_DB] as Database
    return database
  },
)

/**
 * Get the current pg DataSource instance from the request, (the one that corresponds to the requested schema)
 */
export const CurrentSchema = createParamDecorator<any, DataSource | undefined>(
  (_data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()
    const database = request[CURRENT_SCHEMA_PG] as DataSource
    if (!database) {
      throw new Exception(Exception.SCHEMA_NOT_FOUND)
    }
    return database
  },
)

/**
 * Get the project pg DataSource instance from the request, (the one that corresponds to the project)
 */
export const ProjectPg = createParamDecorator<any, DataSource | undefined>(
  (_data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()
    const dataSource = request[PROJECT_PG] as DataSource
    if (!dataSource) {
      throw new Exception(Exception.DATABASE_NOT_FOUND)
    }
    return dataSource
  },
)

/**
 * Get the audit instance for the project from the request
 */
export const ProjectAudits = createParamDecorator<any, Audit>(
  (_data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()
    const audit = request[AUDITS_FOR_PROJECT] as Audit
    return audit
  },
)
