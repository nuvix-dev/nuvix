import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Exception } from '@nuvix/core/extend/exception'
import { SchemaJob, SchemaQueueOptions } from '@nuvix/core/resolvers'
import { DataSource } from '@nuvix/pg'
import { QueueFor, Schema, Schemas, SchemaType } from '@nuvix/utils'
import type { ProjectsDoc } from '@nuvix/utils/types'
import { Queue } from 'bullmq'
// DTO's
import { CreateSchemaDTO } from './DTO/create-schema.dto'

@Injectable()
export class DatabaseService {
  constructor(
    @InjectQueue(QueueFor.DATABASE)
    private readonly databasesQueue: Queue<SchemaQueueOptions, any, SchemaJob>,
  ) {}

  public async createDocumentSchema(
    db: DataSource,

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

    await this.db.execute('select system.create_schema(?, ?, ?)', [
      data.name,
      data.type,
      data.description ?? null,
    ])
    const schema = db
      .table<Schema>('schemas')
      .withSchema(Schemas.System)
      .select('*')
      .where('name', data.name)
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
    const qb = pg
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

    await pg.execute('select system.create_schema(?, ?, ?)', [
      data.name,
      data.type,
      data.description ?? null,
    ])
    const schema = pg
      .table<Schema>('schemas')
      .withSchema(Schemas.System)
      .select('*')
      .where('name', data.name)
      .then(rows => rows[0])

    return schema
  }
}
