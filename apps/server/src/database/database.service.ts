import { Injectable } from '@nestjs/common'
import { DataSource } from '@nuvix/pg'
import { Exception } from '@nuvix/core/extend/exception'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { SchemaJob, SchemaQueueOptions } from '@nuvix/core/resolvers'
import { QueueFor, Schema, Schemas, SchemaType } from '@nuvix/utils'

// DTO's
import { CreateSchemaDTO } from './DTO/create-schema.dto'
import type { ProjectsDoc } from '@nuvix/utils/types'

@Injectable()
export class DatabaseService {
  constructor(
    @InjectQueue(QueueFor.DATABASE)
    private readonly databasesQueue: Queue<SchemaQueueOptions, any, SchemaJob>,
  ) {}

  public async createDocumentSchema(
    db: DataSource,
    project: ProjectsDoc,
    data: CreateSchemaDTO,
  ) {
    const isExists = await db
      .table<Schemas>('schemas')
      .withSchema(Schemas.System)
      .where('name', data.name)
      .first()

    if (isExists) {
      throw new Exception(Exception.SCHEMA_ALREADY_EXISTS)
    }

    const schema = await db
      .table<Schema>('schemas')
      .withSchema(Schemas.System)
      .insert({
        name: data.name,
        type: SchemaType.Document,
        description: data.description,
      })
      .returning('*')
      .then(rows => rows[0])

    await this.databasesQueue.add(SchemaJob.INIT_DOC, {
      project: project,
      schema: data.name,
    })

    return schema
  }

  /**
   * @description Get all schemas
   */
  public async getSchemas(pg: DataSource, type?: SchemaType) {
    let qb = pg
      .table('schemas', { schema: Schemas.System })
      .select('name', 'description', 'type')
      .whereNotIn('name', Object.values(Schemas))

    if (type) {
      qb.where('type', '=', type)
    }

    const schemas = await qb
    return {
      data: schemas,
      total: schemas.length,
    }
  }

  /**
   * Get a schema by name
   */
  public async getSchema(pg: DataSource, name: string) {
    const schema = await pg
      .table<Schema>('schemas')
      .withSchema(Schemas.System)
      .where('name', name)
      .first()

    if (!schema) {
      throw new Exception(Exception.SCHEMA_NOT_FOUND)
    }

    return schema
  }

  /**
   * Create a schema
   */
  public async createSchema(pg: DataSource, data: CreateSchemaDTO) {
    const isExists = await pg
      .table<Schema>('schemas')
      .withSchema(Schemas.System)
      .where('name', data.name)
      .first()

    if (isExists) {
      throw new Exception(
        Exception.SCHEMA_ALREADY_EXISTS,
        'Schema already exists, please choose another name',
      )
    }

    const schema = await pg
      .table<Schema>('schemas')
      .withSchema(Schemas.System)
      .insert({
        name: data.name,
        type: data.type,
        description: data.description,
      })
      .returning('*')
      .then(rows => rows[0])

    return schema
  }
}
