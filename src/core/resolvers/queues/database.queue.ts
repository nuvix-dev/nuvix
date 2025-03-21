import {
  Authorization,
  Database,
  DatabaseError,
  Document,
  Query,
} from '@nuvix/database';
import { Queue } from './queue';
import { Exception } from 'src/core/extend/exception';
import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  DATABASE_TYPE_CREATE_ATTRIBUTE,
  DATABASE_TYPE_CREATE_INDEX,
  DATABASE_TYPE_DELETE_ATTRIBUTE,
  DATABASE_TYPE_DELETE_COLLECTION,
  DATABASE_TYPE_DELETE_DATABASE,
  DATABASE_TYPE_DELETE_INDEX,
  DB_FOR_CONSOLE,
  GET_PROJECT_DB,
} from 'src/Utils/constants';
import { Inject, Logger } from '@nestjs/common';

@Processor('database')
export class DatabaseQueue extends Queue {
  private readonly logger = new Logger(DatabaseQueue.name);

  constructor(
    @Inject(DB_FOR_CONSOLE) private readonly dbForConsole: Database,
    @Inject(GET_PROJECT_DB)
    private readonly getProjectDb: (projectId: string) => Promise<Database>,
  ) {
    super();
  }

  async process(job: Job, token?: string): Promise<any> {
    switch (job.name) {
      case DATABASE_TYPE_CREATE_ATTRIBUTE:
        return await this.createAttribute(job.data, token);

      case DATABASE_TYPE_DELETE_ATTRIBUTE:
        return await this.deleteAttribute(job.data, token);

      case DATABASE_TYPE_CREATE_INDEX:
        return await this.createIndex(job.data, token);

      case DATABASE_TYPE_DELETE_INDEX:
        return await this.deleteIndex(job.data, token);

      case DATABASE_TYPE_DELETE_DATABASE:
        return await this.deleteDatabase(job.data, token);

      case DATABASE_TYPE_DELETE_COLLECTION:
        return await this.deleteCollection(job.data, token);

      default:
        this.logger.error('Invalid job type');
        throw new Exception(Exception.GENERAL_SERVER_ERROR);
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.verbose(
      `Processing job ${job.id} of type ${job.name} with data ${job.data}...`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: any) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed with error: ${err.message}`,
    );
  }

  private async createAttribute(data: any, token: string): Promise<void> {
    const database = new Document(data.database);
    const collection = new Document(data.collection);
    let attribute = new Document(data.attribute);
    const project = new Document(data.project);

    this.logger.debug(
      'createAttribute',
      database,
      collection,
      attribute,
      project,
    );

    const dbForConsole = this.dbForConsole;
    const dbForProject = await this.getProjectDb(project.getId());

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
    //   attributeId: attribute.getAttribute("key") 
    // });

    await Authorization.skip(async () => {
      dbForProject.setPrefix(`_${project.getAttribute('$internalId')}`);
      attribute = await dbForProject.getDocument(
        'attributes',
        attribute.getAttribute("key") ,
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
      const projectDoc = await dbForConsole.getDocument('projects', projectId);

      let relatedAttribute: Document;
      let relatedCollection: Document;

      try {
        switch (type) {
          case Database.VAR_RELATIONSHIP:
            relatedCollection = await dbForProject.getDocument(
              'database_' + database.getInternalId(),
              options['relatedCollection'],
            );
            if (relatedCollection.isEmpty()) {
              throw new DatabaseError('Collection not found');
            }

            if (
              !(await dbForProject.createRelationship(
                'database_' +
                  database.getInternalId() +
                  '_collection_' +
                  collection.getInternalId(),
                'database_' +
                  database.getInternalId() +
                  '_collection_' +
                  relatedCollection.getInternalId(),
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
                database.getInternalId() +
                  '_' +
                  relatedCollection.getInternalId() +
                  '_' +
                  options['twoWayKey'],
              );
              await dbForProject.updateDocument(
                'attributes',
                relatedAttribute.getAttribute("key") ,
                relatedAttribute.setAttribute('status', 'available'),
              );
            }
            break;
          default:
            if (
              !(await dbForProject.createAttribute(
                'database_' +
                  database.getInternalId() +
                  '_collection_' +
                  collection.getInternalId(),
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
          attribute.getAttribute("key") ,
          attribute.setAttribute('status', 'available'),
        );
      } catch (e) {
        console.error(e.message);

        if (e instanceof DatabaseError) {
          attribute.setAttribute('error', e.message);
          if (relatedAttribute) {
            relatedAttribute.setAttribute('error', e.message);
          }
        }

        await dbForProject.updateDocument(
          'attributes',
          attribute.getAttribute("key") ,
          attribute.setAttribute('status', 'failed'),
        );

        if (relatedAttribute) {
          await dbForProject.updateDocument(
            'attributes',
            relatedAttribute.getAttribute("key") ,
            relatedAttribute.setAttribute('status', 'failed'),
          );
        }
      } finally {
        // this.trigger(database, collection, attribute, projectDoc, projectId, events);
      }

      if (type === Database.VAR_RELATIONSHIP && options['twoWay']) {
        await dbForProject.purgeCachedDocument(
          'database_' + database.getInternalId(),
          relatedCollection.getId(),
        );
      }

      await dbForProject.purgeCachedDocument(
        'database_' + database.getInternalId(),
        collectionId,
      );
    });
  }

  private async deleteAttribute(data: any, token: any): Promise<void> {
    const database = new Document(data.database);
    const collection = new Document(data.collection);
    let attribute = new Document(data.attribute);
    const project = new Document(data.project);
    const dbForConsole = this.dbForConsole;
    const dbForProject = await this.getProjectDb(project.getId());

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
    //   attributeId: attribute.getAttribute("key") 
    // });

    await Authorization.skip(async () => {
      dbForProject.setPrefix(`_${project.getAttribute('$internalId')}`);
      const collectionId = collection.getId();
      const key = attribute.getAttribute('key', '');
      const status = attribute.getAttribute('status', '');
      const type = attribute.getAttribute('type', '');
      const projectDoc = await dbForConsole.getDocument('projects', projectId);
      const options = attribute.getAttribute('options', []);
      let relatedAttribute: Document;
      let relatedCollection: Document;

      try {
        if (status !== 'failed') {
          if (type === Database.VAR_RELATIONSHIP) {
            if (options['twoWay']) {
              relatedCollection = await dbForProject.getDocument(
                'database_' + database.getInternalId(),
                options['relatedCollection'],
              );
              if (relatedCollection.isEmpty()) {
                throw new DatabaseError('Collection not found');
              }
              relatedAttribute = await dbForProject.getDocument(
                'attributes',
                database.getInternalId() +
                  '_' +
                  relatedCollection.getInternalId() +
                  '_' +
                  options['twoWayKey'],
              );
            }

            if (
              !(await dbForProject.deleteRelationship(
                'database_' +
                  database.getInternalId() +
                  '_collection_' +
                  collection.getInternalId(),
                key,
              ))
            ) {
              await dbForProject.updateDocument(
                'attributes',
                relatedAttribute.getAttribute("key") ,
                relatedAttribute.setAttribute('status', 'stuck'),
              );
              throw new DatabaseError('Failed to delete Relationship');
            }
          } else if (
            !(await dbForProject.deleteAttribute(
              'database_' +
                database.getInternalId() +
                '_collection_' +
                collection.getInternalId(),
              key,
            ))
          ) {
            throw new DatabaseError('Failed to delete Attribute');
          }
        }

        await dbForProject.deleteDocument('attributes', attribute.getAttribute("key") );

        if (relatedAttribute && !relatedAttribute.isEmpty()) {
          await dbForProject.deleteDocument(
            'attributes',
            relatedAttribute.getAttribute("key") ,
          );
        }
      } catch (e) {
        console.error(e.message);

        if (e instanceof DatabaseError) {
          attribute.setAttribute('error', e.message);
          if (relatedAttribute && !relatedAttribute.isEmpty()) {
            relatedAttribute.setAttribute('error', e.message);
          }
        }
        await dbForProject.updateDocument(
          'attributes',
          attribute.getAttribute("key") ,
          attribute.setAttribute('status', 'stuck'),
        );
        if (relatedAttribute && !relatedAttribute.isEmpty()) {
          await dbForProject.updateDocument(
            'attributes',
            relatedAttribute.getAttribute("key") ,
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
                  database,
                  collection,
                  index,
                  projectDoc,
                  dbForConsole,
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

      await dbForProject.purgeCachedDocument(
        'database_' + database.getInternalId(),
        collectionId,
      );
      await dbForProject.purgeCachedCollection(
        'database_' +
          database.getInternalId() +
          '_collection_' +
          collection.getInternalId(),
      );

      if (
        relatedCollection &&
        !relatedCollection.isEmpty() &&
        relatedAttribute &&
        !relatedAttribute.isEmpty()
      ) {
        await dbForProject.purgeCachedDocument(
          'database_' + database.getInternalId(),
          relatedCollection.getId(),
        );
        await dbForProject.purgeCachedCollection(
          'database_' +
            database.getInternalId() +
            '_collection_' +
            relatedCollection.getInternalId(),
        );
      }
    });
  }

  private async createIndex(data: any, token: any): Promise<void> {
    const database = new Document(data.database);
    const collection = new Document(data.collection);
    let index = new Document(data.index);
    const project = new Document(data.project);
    const dbForConsole = this.dbForConsole;
    const dbForProject = await this.getProjectDb(project.getId());

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

    await Authorization.skip(async () => {
      dbForProject.setPrefix(`_${project.getAttribute('$internalId')}`);
      const collectionId = collection.getId();
      const key = index.getAttribute('key', '');
      const type = index.getAttribute('type', '');
      const attributes = index.getAttribute('attributes', []);
      const lengths = index.getAttribute('lengths', []);
      const orders = index.getAttribute('orders', []);
      const projectDoc = await dbForConsole.getDocument('projects', projectId);

      try {
        if (
          !(await dbForProject.createIndex(
            'database_' +
              database.getInternalId() +
              '_collection_' +
              collection.getInternalId(),
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

      await dbForProject.purgeCachedDocument(
        'database_' + database.getInternalId(),
        collectionId,
      );
    });
  }

  private async deleteIndex(data: any, token: any): Promise<void> {
    const database = new Document(data.database);
    const collection = new Document(data.collection);
    let index = new Document(data.index);
    const project = new Document(data.project);
    const dbForConsole = this.dbForConsole;
    const dbForProject = await this.getProjectDb(project.getId());

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

    await Authorization.skip(async () => {
      dbForProject.setPrefix(`_${project.getAttribute('$internalId')}`);
      const key = index.getAttribute('key', '');
      const status = index.getAttribute('status', '');
      const projectDoc = await dbForConsole.getDocument('projects', projectId);

      try {
        if (
          status !== 'failed' &&
          !(await dbForProject.deleteIndex(
            'database_' +
              database.getInternalId() +
              '_collection_' +
              collection.getInternalId(),
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
        'database_' + database.getInternalId(),
        collection.getId(),
      );
    });
  }

  private async deleteDatabase(data: any, token: any): Promise<void> {
    const database = new Document(data.database);
    const project = new Document(data.project);
    const dbForProject = await this.getProjectDb(project.getId());

    const databaseId = 'database_' + database.getInternalId();

    await Authorization.skip(async () => {
      dbForProject.setPrefix(`_${project.getAttribute('$internalId')}`);
      await this.deleteByGroup(
        databaseId,
        [],
        dbForProject,
        async (collection: Document) => {
          await this.deleteCollection(
            {
              database,
              collection,
              project,
              dbForProject,
            },
            token,
          );
        },
      );

      await dbForProject.deleteCollection(databaseId);

      await this.deleteAuditLogsByResource(
        'database/' + database.getId(),
        project,
        dbForProject,
      );
    });
  }

  private async deleteCollection(data: any, token: any): Promise<void> {
    const database = new Document(data.database);
    const project = new Document(data.project);
    let collection = new Document(data.collection);
    const dbForProject = await this.getProjectDb(project.getId());

    if (collection.isEmpty()) {
      throw new Error('Missing collection');
    }

    await Authorization.skip(async () => {
      dbForProject.setPrefix(`_${project.getAttribute('$internalId')}`);
      const collectionId = collection.getId();
      const collectionInternalId = collection.getInternalId();
      const databaseId = database.getId();
      const databaseInternalId = database.getInternalId();

      await this.deleteByGroup(
        'attributes',
        [
          Query.equal('databaseInternalId', [databaseInternalId]),
          Query.equal('type', [Database.VAR_RELATIONSHIP]),
          Query.notEqual('collectionInternalId', collectionInternalId),
          Query.contains('options', [`"relatedCollection":"${collectionId}"`]),
        ],
        dbForProject,
        async (attribute: Document) => {
          await dbForProject.purgeCachedDocument(
            'database_' + databaseInternalId,
            attribute.getAttribute('collectionId'),
          );
          await dbForProject.purgeCachedCollection(
            'database_' +
              databaseInternalId +
              '_collection_' +
              attribute.getAttribute('collectionInternalId'),
          );
        },
      );

      await dbForProject.deleteCollection(
        'database_' +
          databaseInternalId +
          '_collection_' +
          collectionInternalId,
      );

      await this.deleteByGroup(
        'attributes',
        [
          Query.equal('databaseInternalId', [databaseInternalId]),
          Query.equal('collectionInternalId', [collectionInternalId]),
        ],
        dbForProject,
      );

      await this.deleteByGroup(
        'indexes',
        [
          Query.equal('databaseInternalId', [databaseInternalId]),
          Query.equal('collectionInternalId', [collectionInternalId]),
        ],
        dbForProject,
      );

      await this.deleteAuditLogsByResource(
        'database/' + databaseId + '/collection/' + collectionId,
        project,
        dbForProject,
      );
    });
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

  private async trigger(
    database: Document,
    collection: Document,
    attribute: Document,
    project: Document,
    projectId: string,
    events: string[],
  ): Promise<void> {
    // const target = Realtime.fromPayload(
    //   events[0],
    //   attribute,
    //   project
    // );
    // await Realtime.send(
    //   'console',
    //   attribute.toObject(),
    //   events,
    //   target.channels,
    //   target.roles,
    //   {
    //     projectId,
    //     databaseId: database.getId(),
    //     collectionId: collection.getId()
    //   }
    // );
  }
}
