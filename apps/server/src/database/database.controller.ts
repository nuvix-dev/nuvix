import {
  Body,
  Controller,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import { DatabaseService } from './database.service'
import { ProjectGuard } from '@nuvix/core/resolvers'
import { ResponseInterceptor, ApiInterceptor } from '@nuvix/core/resolvers'
import { DataSource } from '@nuvix/pg'
import { Models } from '@nuvix/core/helpers'
import {
  Auth,
  AuthType,
  Namespace,
  Project,
  ProjectPg,
} from '@nuvix/core/decorators'

// DTO's
import {
  CreateSchemaDTO,
  SchemaParamsDTO,
  SchemaQueryDTO,
} from './DTO/create-schema.dto'
import type { ProjectsDoc } from '@nuvix/utils/types'
import { IListResponse, SchemaType } from '@nuvix/utils'
import { Get, Post } from '@nuvix/core'

@Controller({ version: ['1'], path: ['database'] })
@UseGuards(ProjectGuard)
@Namespace('database')
@UseInterceptors(ResponseInterceptor, ApiInterceptor)
@Auth([AuthType.ADMIN, AuthType.KEY])
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get('schemas', {
    summary: 'List schemas',
    description:
      'Retrieve a list of all schemas in the database with optional filtering by type',
    scopes: 'schemas.read',
    model: { type: Models.SCHEMA, list: true },
    sdk: {
      name: 'listSchemas',
    },
  })
  async getSchemas(
    @ProjectPg() pg: DataSource,
    @Query() { type }: SchemaQueryDTO,
  ): Promise<IListResponse<unknown>> {
    const schemas = await this.databaseService.getSchemas(pg, type)
    return schemas
  }

  @Post('schemas', {
    summary: 'Create schema',
    description:
      'Create a new schema in the database. Supports managed, unmanaged, and document schema types',
    scopes: 'schemas.create',
    model: Models.SCHEMA,
    sdk: {
      name: 'createSchema',
      code: 202,
    },
  })
  async createSchema(
    @ProjectPg() pg: DataSource,
    @Body() body: CreateSchemaDTO,
    @Project() project: ProjectsDoc,
  ) {
    const result = await (body.type !== SchemaType.Document
      ? this.databaseService.createSchema(pg, body)
      : this.databaseService.createDocumentSchema(pg, project, body))
    return result
  }

  @Get('schemas/:schemaId', {
    summary: 'Get schema',
    description: 'Retrieve a specific schema by its ID',
    scopes: 'schemas.read',
    model: Models.SCHEMA,
    sdk: {
      name: 'getSchema',
    },
  })
  async getSchema(
    @ProjectPg() pg: DataSource,
    @Param() { schemaId }: SchemaParamsDTO,
  ) {
    const result = await this.databaseService.getSchema(pg, schemaId)
    return result
  }
}
