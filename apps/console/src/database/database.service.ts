import { Injectable, Logger } from '@nestjs/common';
import { Document } from '@nuvix/database';
import { DataSource } from '@nuvix/pg';
import { Exception } from '@nuvix/core/extend/exception';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  SchemaJobs,
  SchemaQueueOptions,
} from '@nuvix/core/resolvers/queues/schema.queue';
import { INTERNAL_SCHEMAS } from '@nuvix/utils/constants';

// DTO's
import { CreateDocumentSchema, CreateSchema } from './DTO/create-schema.dto';
import { CreateTableDto } from './DTO/create-table.dto';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @InjectQueue('schema')
    private readonly schemasQueue: Queue<SchemaQueueOptions, any, SchemaJobs>,
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

    await this.schemasQueue.add('init_doc', {
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
      .table('schemas', { schema: 'metadata' })
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

  /**
   * Get all tables
   */
  public async getTables(pg: DataSource, schema: string) {
    const isExists = await pg.getSchema(schema);
    if (!isExists) {
      throw new Exception(Exception.SCHEMA_NOT_FOUND);
    }
    const tables = await pg.getMetadataForSchema(schema);

    return {
      tables: tables,
      total: tables.length,
    };
  }

  /**
   * Get a table by name
   */
  public async getTable(pg: DataSource, schema: string, name: string) {
    const isExists = await pg.getSchema(schema);
    if (!isExists) {
      throw new Exception(Exception.SCHEMA_NOT_FOUND);
    }
    const table = await pg.getMetadata(name, schema);

    if (!table) {
      throw new Exception(Exception.GENERAL_NOT_FOUND, 'Table not found');
    }

    return table;
  }

  /**
   * Create a table
   */
  public async createTable(
    pg: DataSource,
    schema: string,
    data: CreateTableDto,
  ) {
    const table = await pg.createTable({
      ...data,
      schema: schema,
    });
    return table;
  }

  public async executeQuery(pg: DataSource, sql: string) {
    return await pg.execute(sql);
  }
}
