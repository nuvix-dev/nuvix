import { Injectable, Logger } from '@nestjs/common';
import { Document } from '@nuvix/database';
import { DataSource } from '@nuvix/pg';
import { Exception } from '@nuvix/core/extend/exception';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  SchemaJobs,
  SchemaQueueOptions,
} from '@nuvix/core/resolvers/queues/databases.queue';
import {
  INTERNAL_SCHEMAS,
  SYSTEM_SCHEMA,
  QueueFor,
} from '@nuvix/utils/constants';

// DTO's
import { CreateDocumentSchema, CreateSchema } from './DTO/create-schema.dto';

@Injectable()
export class DatabasesService {
  private readonly logger = new Logger(DatabasesService.name);

  constructor(
    @InjectQueue(QueueFor.DATABASES)
    private readonly databasesQueue: Queue<SchemaQueueOptions, any, SchemaJobs>,
  ) {}

  public async createDocumentSchema(
    db: DataSource,
    project: Document,
    data: CreateDocumentSchema,
  ) {
    const isExists = await db.getSchema(data.name);

    if (isExists) {
      throw new Exception(Exception.SCHEMA_ALREADY_EXISTS);
    }

    const schema = await db.createSchema(
      data.name,
      'document',
      data.description,
    );

    await this.databasesQueue.add('init_doc', {
      project: project,
      schema: schema.name,
    });

    return schema;
  }

  /**
   * @description Get all schemas
   */
  public async getSchemas(pg: DataSource) {
    const schemas = await pg
      .table('schemas', { schema: SYSTEM_SCHEMA })
      .select('name', 'description', 'type')
      .whereNotIn('name', INTERNAL_SCHEMAS);

    return {
      schemas: schemas,
      total: schemas.length,
    };
  }

  /**
   * Get a schema by name
   */
  public async getSchema(pg: DataSource, name: string) {
    const schema = await pg.getSchema(name);

    if (!schema) {
      throw new Exception(Exception.SCHEMA_NOT_FOUND);
    }

    return schema;
  }

  /**
   * Create a schema
   */
  public async createSchema(pg: DataSource, data: CreateSchema) {
    const isExists = await pg.getSchema(data.name);

    if (isExists) {
      throw new Exception(
        Exception.SCHEMA_ALREADY_EXISTS,
        'Schema already exists, please choose another name',
      );
    }

    const schema = await pg.createSchema(
      data.name,
      data.type,
      data.description,
    );

    return schema;
  }
}
