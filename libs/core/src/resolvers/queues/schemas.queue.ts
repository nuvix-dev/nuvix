import {
  Authorization,
  Database,
  DatabaseError,
  Document,
  Query,
} from '@nuvix/database';
import { Queue } from './queue';
import { Exception } from '@nuvix/core/extend/exception';
import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  APP_POSTGRES_PASSWORD,
  DATABASE_TYPE_CREATE_ATTRIBUTE,
  DATABASE_TYPE_CREATE_INDEX,
  DATABASE_TYPE_DELETE_ATTRIBUTE,
  DATABASE_TYPE_DELETE_COLLECTION,
  DATABASE_TYPE_DELETE_DATABASE,
  DATABASE_TYPE_DELETE_INDEX,
  DB_FOR_PLATFORM,
  GET_PROJECT_DB,
  GET_PROJECT_DB_CLIENT,
  QueueFor,
} from '@nuvix/utils/constants';
import { Inject, Logger } from '@nestjs/common';
import type { GetProjectDbFn, GetClientFn } from '@nuvix/core/core.module';

@Processor(QueueFor.SCHEMAS, { concurrency: 10000 })
export class SchemasQueue extends Queue {
  private readonly logger = new Logger(SchemasQueue.name);

  constructor(
    @Inject(DB_FOR_PLATFORM) private readonly dbForPlatform: Database,
    @Inject(GET_PROJECT_DB_CLIENT) private readonly getDbClient: GetClientFn,
    @Inject(GET_PROJECT_DB)
    private readonly getProjectDb: GetProjectDbFn,
  ) {
    super();
  }

  async process(job: Job, token?: string): Promise<any> {
    switch (job.name) {
      case DATABASE_TYPE_CREATE_ATTRIBUTE:
        await this.createAttribute(job.data, token);
        break;
      case DATABASE_TYPE_DELETE_ATTRIBUTE:
        await this.deleteAttribute(job.data, token);
        break;
      case DATABASE_TYPE_CREATE_INDEX:
        await this.createIndex(job.data, token);
        break;
      case DATABASE_TYPE_DELETE_INDEX:
        await this.deleteIndex(job.data, token);
        break;
      case DATABASE_TYPE_DELETE_COLLECTION:
        await this.deleteCollection(job.data, token);
        break;
      default:
        this.logger.error('Invalid job type');
        throw new Exception(Exception.GENERAL_SERVER_ERROR);
    }

    // TODO: --------
    return {
      done: true,
    };
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.verbose(`Processing job ${job.id} of type ${job.name}...`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: any) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed with error: ${err.message}`,
    );
  }

  private async createAttribute(data: any, token: string): Promise<void> {
    const collection = new Document(data.collection);
    let attribute = new Document(data.attribute);
    const project = new Document(data.project);

    this.logger.debug('createAttribute', {
      collection: collection.getAttribute('name'),
      attribute,
    });

    const { client, dbForProject } = await this.getDatabase(
      project,
      data.database,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }
    if (attribute.isEmpty()) {
      throw new Exception(Exception.ATTRIBUTE_NOT_FOUND);
    }

    const projectId = project.getId();

    // const events = Event.generateEvents('databases.[databaseId].collections.[collectionId].attributes.[attributeId].update', {
    //   databaseId: database.getId(),
    //   collectionId: collection.getId(),
    //   attributeId: attribute.getId()
    // });
    try {
      await Authorization.skip(async () => {
        attribute = await dbForProject.getDocument(
          'attributes',
          attribute.getId(),
        );

        if (attribute.isEmpty()) {
          return;
        }

        const collectionId = collection.getId();
        const key = attribute.getAttribute('key', '');
        const type = attribute.getAttribute('type', '');
        const size = attribute.getAttribute('size', 0);
        const required = attribute.getAttribute('required', false);
        const defaultValue = attribute.getAttribute('default', null);
        const signed = attribute.getAttribute('signed', true);
        const array = attribute.getAttribute('array', false);
        const format = attribute.getAttribute('format', '');
        const formatOptions = attribute.getAttribute('formatOptions', {});
        const filters = attribute.getAttribute('filters', []);
        const options = attribute.getAttribute('options', {});

        let relatedAttribute: Document;
        let relatedCollection: Document;

        try {
          switch (type) {
            case Database.VAR_RELATIONSHIP:
              relatedCollection = await dbForProject.getDocument(
                'collections',
                options['relatedCollection'],
              );
              if (relatedCollection.isEmpty()) {
                throw new DatabaseError('Collection not found');
              }
              if (
                !(await dbForProject.createRelationship(
                  'collection_' + collection.getInternalId(),
                  'collection_' + relatedCollection.getInternalId(),
                  options['relationType'],
                  options['twoWay'],
                  key,
                  options['twoWayKey'],
                  options['onDelete'],
                ))
              ) {
                throw new DatabaseError('Failed to create Attribute');
              }

              if (options['twoWay']) {
                relatedAttribute = await dbForProject.getDocument(
                  'attributes',
                  `related_${relatedCollection.getInternalId()}_${options['twoWayKey']}`,
                );
                await dbForProject.updateDocument(
                  'attributes',
                  relatedAttribute.getId(),
                  relatedAttribute.setAttribute('status', 'available'),
                );
              }
              break;
            default:
              if (
                !(await dbForProject.createAttribute(
                  'collection_' + collection.getInternalId(),
                  key,
                  type,
                  size,
                  required,
                  defaultValue,
                  signed,
                  array,
                  format,
                  formatOptions,
                  filters,
                ))
              ) {
                throw new Error('Failed to create Attribute');
              }
          }

          await dbForProject.updateDocument(
            'attributes',
            attribute.getId(),
            attribute.setAttribute('status', 'available'),
          );
        } catch (e) {
          this.logger.error(e.message);

          if (e instanceof DatabaseError) {
            attribute.setAttribute('error', e.message);
            if (relatedAttribute) {
              relatedAttribute.setAttribute('error', e.message);
            }
          }

          await dbForProject.updateDocument(
            'attributes',
            attribute.getId(),
            attribute.setAttribute('status', 'failed'),
          );

          if (relatedAttribute) {
            await dbForProject.updateDocument(
              'attributes',
              relatedAttribute.getId(),
              relatedAttribute.setAttribute('status', 'failed'),
            );
          }
        } finally {
          // this.trigger(database, collection, attribute, projectDoc, projectId, events);
        }

        if (type === Database.VAR_RELATIONSHIP && options['twoWay']) {
          await dbForProject.purgeCachedDocument(
            `collections`,
            relatedCollection.getId(),
          );
        }

        await dbForProject.purgeCachedDocument('collections', collectionId);
      });
    } finally {
      await this.releaseClient(client);
    }
  }

  private async deleteAttribute(data: any, token: any): Promise<void> {
    const collection = new Document(data.collection);
    const attribute = new Document(data.attribute);
    const project = new Document(data.project);
    const dbForPlatform = this.dbForPlatform;
    const { client, dbForProject } = await this.getDatabase(
      project,
      data.database,
    );

    if (collection.isEmpty()) {
      throw new Error('Missing collection');
    }
    if (attribute.isEmpty()) {
      throw new Error('Missing attribute');
    }

    const projectId = project.getId();

    // const events = Event.generateEvents('databases.[databaseId].collections.[collectionId].attributes.[attributeId].delete', {
    //   databaseId: database.getId(),
    //   collectionId: collection.getId(),
    //   attributeId: attribute.getId()
    // });

    try {
      await Authorization.skip(async () => {
        const collectionId = collection.getId();
        const key = attribute.getAttribute('key', '');
        const status = attribute.getAttribute('status', '');
        const type = attribute.getAttribute('type', '');
        const projectDoc = await dbForPlatform.getDocument(
          'projects',
          projectId,
        );
        const options = attribute.getAttribute('options', []);
        let relatedAttribute: Document;
        let relatedCollection: Document;

        try {
          if (status !== 'failed') {
            if (type === Database.VAR_RELATIONSHIP) {
              if (options['twoWay']) {
                relatedCollection = await dbForProject.getDocument(
                  'collections',
                  options['relatedCollection'],
                );
                if (relatedCollection.isEmpty()) {
                  throw new DatabaseError('Collection not found');
                }
                relatedAttribute = await dbForProject.getDocument(
                  'attributes',
                  relatedCollection.getInternalId() +
                  '_' +
                  options['twoWayKey'],
                );
              }

              if (
                !(await dbForProject.deleteRelationship(
                  'collection_' + collection.getInternalId(),
                  key,
                ))
              ) {
                await dbForProject.updateDocument(
                  'attributes',
                  relatedAttribute.getId(),
                  relatedAttribute.setAttribute('status', 'stuck'),
                );
                throw new DatabaseError('Failed to delete Relationship');
              }
            } else if (
              !(await dbForProject.deleteAttribute(
                'collection_' + collection.getInternalId(),
                key,
              ))
            ) {
              throw new DatabaseError('Failed to delete Attribute');
            }
          }

          await dbForProject.deleteDocument('attributes', attribute.getId());

          if (relatedAttribute && !relatedAttribute.isEmpty()) {
            await dbForProject.deleteDocument(
              'attributes',
              relatedAttribute.getId(),
            );
          }
        } catch (e) {
          this.logger.error(e.message);

          if (e instanceof DatabaseError) {
            attribute.setAttribute('error', e.message);
            if (relatedAttribute && !relatedAttribute.isEmpty()) {
              relatedAttribute.setAttribute('error', e.message);
            }
          }
          await dbForProject.updateDocument(
            'attributes',
            attribute.getId(),
            attribute.setAttribute('status', 'stuck'),
          );
          if (relatedAttribute && !relatedAttribute.isEmpty()) {
            await dbForProject.updateDocument(
              'attributes',
              relatedAttribute.getId(),
              relatedAttribute.setAttribute('status', 'stuck'),
            );
          }
        } finally {
          // this.trigger(database, collection, attribute, projectDoc, projectId, events);
        }

        const indexes = collection.getAttribute('indexes', []);

        for (const index of indexes) {
          const attributes = index.getAttribute('attributes');
          const lengths = index.getAttribute('lengths');
          const orders = index.getAttribute('orders');

          const found = attributes.indexOf(key);

          if (found !== -1) {
            attributes.splice(found, 1);
            if (lengths[found]) lengths.splice(found, 1);
            if (orders[found]) orders.splice(found, 1);

            if (attributes.length === 0) {
              await dbForProject.deleteDocument('indexes', index.getId());
            } else {
              index.setAttribute('attributes', attributes);
              index.setAttribute('lengths', lengths);
              index.setAttribute('orders', orders);

              let exists = false;
              for (const existing of indexes) {
                if (
                  existing.getAttribute('key') !== index.getAttribute('key') &&
                  existing.getAttribute('attributes').toString() ===
                  index.getAttribute('attributes').toString() &&
                  existing.getAttribute('orders').toString() ===
                  index.getAttribute('orders').toString()
                ) {
                  exists = true;
                  break;
                }
              }

              if (exists) {
                await this.deleteIndex(
                  {
                    database: data.database,
                    collection,
                    index,
                    projectDoc,
                    dbForPlatform,
                    dbForProject,
                  },
                  token,
                );
              } else {
                await dbForProject.updateDocument(
                  'indexes',
                  index.getId(),
                  index,
                );
              }
            }
          }
        }

        await dbForProject.purgeCachedDocument('collections', collectionId);
        await dbForProject.purgeCachedCollection(
          'collection_' + collection.getInternalId(),
        );

        if (
          relatedCollection &&
          !relatedCollection.isEmpty() &&
          relatedAttribute &&
          !relatedAttribute.isEmpty()
        ) {
          await dbForProject.purgeCachedDocument(
            'collections',
            relatedCollection.getId(),
          );
          await dbForProject.purgeCachedCollection(
            'collection_' + relatedCollection.getInternalId(),
          );
        }
      });
    } finally {
      await this.releaseClient(client);
    }
  }

  private async createIndex(data: any, token: any): Promise<void> {
    const collection = new Document(data.collection);
    const index = new Document(data.index);
    const project = new Document(data.project);
    const dbForPlatform = this.dbForPlatform;
    const { client, dbForProject } = await this.getDatabase(
      project,
      data.database,
    );

    if (collection.isEmpty()) {
      throw new Error('Missing collection');
    }
    if (index.isEmpty()) {
      throw new Error('Missing index');
    }

    const projectId = project.getId();

    // const events = Event.generateEvents('databases.[databaseId].collections.[collectionId].indexes.[indexId].update', {
    //   databaseId: database.getId(),
    //   collectionId: collection.getId(),
    //   indexId: index.getId()
    // });

    try {
      await Authorization.skip(async () => {
        const collectionId = collection.getId();
        const key = index.getAttribute('key', '');
        const type = index.getAttribute('type', '');
        const attributes = index.getAttribute('attributes', []);
        const lengths = index.getAttribute('lengths', []);
        const orders = index.getAttribute('orders', []);
        const projectDoc = await dbForPlatform.getDocument(
          'projects',
          projectId,
        );

        try {
          if (
            !(await dbForProject.createIndex(
              'collection_' + collection.getInternalId(),
              key,
              type,
              attributes,
              lengths,
              orders,
            ))
          ) {
            throw new DatabaseError('Failed to create Index');
          }
          await dbForProject.updateDocument(
            'indexes',
            index.getId(),
            index.setAttribute('status', 'available'),
          );
        } catch (e) {
          console.error(e.message);

          if (e instanceof DatabaseError) {
            index.setAttribute('error', e.message);
          }
          await dbForProject.updateDocument(
            'indexes',
            index.getId(),
            index.setAttribute('status', 'failed'),
          );
        } finally {
          // this.trigger(database, collection, index, projectDoc, projectId, events);
        }

        await dbForProject.purgeCachedDocument('collections', collectionId);
      });
    } finally {
      await this.releaseClient(client);
    }
  }

  private async deleteIndex(data: any, token: any): Promise<void> {
    const collection = new Document(data.collection);
    const index = new Document(data.index);
    const project = new Document(data.project);
    const dbForPlatform = this.dbForPlatform;
    const { client, dbForProject } = await this.getDatabase(
      project,
      data.database,
    );

    if (collection.isEmpty()) {
      throw new Error('Missing collection');
    }
    if (index.isEmpty()) {
      throw new Error('Missing index');
    }

    const projectId = project.getId();

    // const events = Event.generateEvents('databases.[databaseId].collections.[collectionId].indexes.[indexId].delete', {
    //   databaseId: database.getId(),
    //   collectionId: collection.getId(),
    //   indexId: index.getId()
    // });
    try {
      await Authorization.skip(async () => {
        const key = index.getAttribute('key', '');
        const status = index.getAttribute('status', '');
        const projectDoc = await dbForPlatform.getDocument(
          'projects',
          projectId,
        );

        try {
          if (
            status !== 'failed' &&
            !(await dbForProject.deleteIndex(
              'collection_' + collection.getInternalId(),
              key,
            ))
          ) {
            throw new DatabaseError('Failed to delete index');
          }
          await dbForProject.deleteDocument('indexes', index.getId());
          index.setAttribute('status', 'deleted');
        } catch (e) {
          console.error(e.message);

          if (e instanceof DatabaseError) {
            index.setAttribute('error', e.message);
          }
          await dbForProject.updateDocument(
            'indexes',
            index.getId(),
            index.setAttribute('status', 'stuck'),
          );
        } finally {
          // this.trigger(database, collection, index, projectDoc, projectId, events);
        }

        await dbForProject.purgeCachedDocument(
          'collections',
          collection.getId(),
        );
      });
    } finally {
      await this.releaseClient(client);
    }
  }

  private async deleteCollection(data: any, token: any): Promise<void> {
    const project = new Document(data.project);
    const collection = new Document(data.collection);
    const { client, dbForProject } = await this.getDatabase(
      project,
      data.database,
    );

    if (collection.isEmpty()) {
      throw new Error('Missing collection');
    }

    try {
      await Authorization.skip(async () => {
        const collectionId = collection.getId();
        const collectionInternalId = collection.getInternalId();

        await this.deleteByGroup(
          'attributes',
          [
            Query.equal('type', [Database.VAR_RELATIONSHIP]),
            Query.notEqual('collectionInternalId', collectionInternalId),
            Query.contains('options', [
              `"relatedCollection":"${collectionId}"`,
            ]),
          ],
          dbForProject,
          async (attribute: Document) => {
            await dbForProject.purgeCachedDocument(
              'collections',
              attribute.getAttribute('collectionId'),
            );
            await dbForProject.purgeCachedCollection(
              'collection_' + attribute.getAttribute('collectionInternalId'),
            );
          },
        );

        await dbForProject.deleteCollection(
          'collection_' + collectionInternalId,
        );

        await this.deleteByGroup(
          'attributes',
          [Query.equal('collectionInternalId', [collectionInternalId])],
          dbForProject,
        );

        await this.deleteByGroup(
          'indexes',
          [Query.equal('collectionInternalId', [collectionInternalId])],
          dbForProject,
        );

        await this.deleteAuditLogsByResource(
          '/collection/' + collectionId,
          project,
          dbForProject,
        );
      });
    } finally {
      await this.releaseClient(client);
    }
  }

  private async deleteAuditLogsByResource(
    resource: string,
    project: Document,
    dbForProject: Database,
  ): Promise<void> {
    // await this.deleteByGroup('audit_logs', [
    //   Query.equal('resource', [resource])
    // ], dbForProject);t this.deleteByGroup('audit_logs', [
    //   Query.equal('resource', [resource])
    // ], d
  }

  private async deleteByGroup(
    collection: string,
    queries: Query[],
    database: Database,
    callback?: (document: Document) => Promise<void>,
  ): Promise<void> {
    let count = 0;
    let chunk = 0;
    const limit = 50;
    let sum = limit;

    const executionStart = Date.now();

    while (sum === limit) {
      chunk++;

      const results = await database.find(collection, [
        Query.limit(limit),
        ...queries,
      ]);

      sum = results.length;

      console.info(`Deleting chunk #${chunk}. Found ${sum} documents`);

      for (const document of results) {
        if (
          await database.deleteDocument(
            document.getCollection(),
            document.getId(),
          )
        ) {
          console.info(`Deleted document "${document.getId()}" successfully`);

          if (callback) {
            await callback(document);
          }
        } else {
          console.warn(`Failed to delete document: ${document.getId()}`);
        }
        count++;
      }
    }

    const executionEnd = Date.now();

    console.info(
      `Deleted ${count} documents by group in ${(executionEnd - executionStart) / 1000} seconds`,
    );
  }

  private async getDatabase(project: Document, database: string) {
    const dbOptions = project.getAttribute('database');
    const client = await this.getDbClient(project.getId(), {
      database: dbOptions.name,
      user: dbOptions.adminRole,
      password: APP_POSTGRES_PASSWORD,
      port: dbOptions.port,
      host: dbOptions.host,
      max: 2,
    });
    const dbForProject = this.getProjectDb(client, project.getId());
    dbForProject.setDatabase(database).setCacheName(`${project.getId()}:${database}`);
    return { client, dbForProject };
  }

  private async releaseClient(
    client: Awaited<ReturnType<typeof this.getDatabase>>['client'],
  ) {
    try {
      if (client) {
        await client.end();
      }
    } catch (error) {
      this.logger.error('Failed to release database client', error);
    }
  }
}

export type DatabaseJobs =
  | typeof DATABASE_TYPE_CREATE_ATTRIBUTE
  | typeof DATABASE_TYPE_CREATE_INDEX
  | typeof DATABASE_TYPE_DELETE_ATTRIBUTE
  | typeof DATABASE_TYPE_DELETE_COLLECTION
  | typeof DATABASE_TYPE_DELETE_DATABASE
  | typeof DATABASE_TYPE_DELETE_INDEX;

export type DatabaseJobData = {
  database: string;
  collection: Document | object;
  attribute?: Document | object;
  index?: Document | object;
  project: Document | object;
  dbForPlatform?: Database;
};
