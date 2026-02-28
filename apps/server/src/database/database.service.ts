import { Injectable } from '@nestjs/common'
import { Exception } from '@nuvix/core/extend/exception'
import { DataSource } from '@nuvix/pg'
import { Schema, Schemas, SchemaType } from '@nuvix/utils'
import { CreateSchemaDTO } from './DTO/create-schema.dto'
import { CoreService } from '@nuvix/core/core.service'
import { Database, Doc, DuplicateException } from '@nuvix/db'
import collections from '@nuvix/utils/collections'

@Injectable()
export class DatabaseService {
  private readonly db: Database
  private readonly dataSource: DataSource

  constructor(private readonly coreService: CoreService) {
    this.db = this.coreService.getDatabase()
    this.dataSource = this.coreService.getDataSource()
  }

  public async createDocumentSchema({
    name,
    type,
    description,
  }: CreateSchemaDTO) {
    const isExists = await this.dataSource
      .table<Schemas>('schemas')
      .withSchema(Schemas.System)
      .where('name', name)
      .first()

    if (isExists) {
      throw new Exception(Exception.SCHEMA_ALREADY_EXISTS)
    }

    await this.dataSource.execute('select system.create_schema(?, ?, ?)', [
      name,
      type,
      description ?? null,
    ])

    try {
      await this.db.create(name)

      for (const [_key, collection] of Object.entries(collections.database)) {
        if (collection.$collection !== Database.METADATA) {
          continue
        }

        const attributes = collection.attributes.map(
          attribute => new Doc(attribute),
        )

        const indexes = (collection.indexes ?? []).map(index => new Doc(index))

        try {
          await this.db.createCollection({
            id: collection.$id,
            attributes,
            indexes,
          })
        } catch (error) {
          if (!(error instanceof DuplicateException)) {
            throw error
          }
        }
      }
    } catch (error) {
      // we will delete the schema if there is an error while creating the document schema to avoid inconsistency
      await this.dataSource
        .table('schemas')
        .withSchema(Schemas.System)
        .where('name', name)
        .delete()

      throw error
    }

    const schema = await this.dataSource
      .table<Schema>('schemas')
      .withSchema(Schemas.System)
      .select('*')
      .where('name', name)
      .then(rows => rows[0])

    return schema
  }

  /**
   * @description Get all schemas
   */
  public async getSchemas(type?: SchemaType) {
    const qb = this.dataSource
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
  public async getSchema(name: string) {
    const schema = await this.dataSource
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
  public async createSchema(data: CreateSchemaDTO) {
    const isExists = await this.dataSource
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

    await this.dataSource.execute('select system.create_schema(?, ?, ?)', [
      data.name,
      data.type,
      data.description ?? null,
    ])
    const schema = await this.dataSource
      .table<Schema>('schemas')
      .withSchema(Schemas.System)
      .select('*')
      .where('name', data.name)
      .then(rows => rows[0])

    return schema
  }
}
