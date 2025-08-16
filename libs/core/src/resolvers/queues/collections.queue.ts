import {
  AttributeType,
  Authorization,
  Database,
  DatabaseException,
  Doc,
  Query,
} from '@nuvix-tech/db';
import { Queue } from './queue';
import { Exception } from '@nuvix/core/extend/exception';
import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QueueFor } from '@nuvix/utils';
import { Logger } from '@nestjs/common';
import type { Attributes, AttributesDoc, Collections, CollectionsDoc, Indexes, IndexesDoc, Projects, ProjectsDoc } from '@nuvix/utils/types';
import { CoreService } from '@nuvix/core/core.service.js';
import { Audit } from '@nuvix/audit';

@Processor(QueueFor.COLLECTIONS, { concurrency: 10000 })
export class CollectionsQueue extends Queue {
  private readonly logger = new Logger(CollectionsQueue.name);
  private readonly dbForPlatform: Database;
  constructor(
    private readonly coreService: CoreService,
  ) {
    super();
    this.dbForPlatform = coreService.getPlatformDb();
  }

  async process(job: Job<JobData, unknown, CollectionsJob>, token?: string): Promise<void> {
    switch (job.name) {
      case CollectionsJob.CREATE_ATTRIBUTE:
        await this.createAttribute(job.data);
        break;
      case CollectionsJob.CREATE_INDEX:
        await this.createIndex(job.data);
        break;
      case CollectionsJob.DELETE_ATTRIBUTE:
        await this.deleteAttribute(job.data);
        break;
      case CollectionsJob.DELETE_INDEX:
        await this.deleteIndex(job.data);
        break;
      case CollectionsJob.DELETE_COLLECTION:
        await this.deleteCollection(job.data);
        break;
      case CollectionsJob.DELETE_SCHEMA:
      // TODO: Implement schema deletion logic
      default:
        this.logger.error('Invalid job type');
        throw new Exception(Exception.GENERAL_SERVER_ERROR);
    }
    return;
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Job ${job.id} of type ${job.name} is now active`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: any) {
    this.logger.error(`Job ${job.id} of type ${job.name} failed with error: ${err.message}`);
  }

  /** @see collectionService */
  getCollectionName(sequence: number): string {
    return `collection_${sequence}`;
  }

  /** @see collectionService */
  getRelatedAttrId(collectionSequence: number, key: string): string {
    return `related_${collectionSequence}_${key}`;
  }

  /** @see collectionService */
  getAttrId(collectionSequence: number, key: string): string {
    return `${collectionSequence}_${key}`;
  }

  /**
   * Creates an attribute in the specified collection.
   */
  private async createAttribute({ database, ...data }: JobData): Promise<void> {
    const collection = new Doc(data.collection);
    let attribute = new Doc(data.attribute);
    const project = new Doc(data.project);

    const { client, dbForProject } = await this.coreService.createProjectDatabase(
      project,
      { schema: database },
    );

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }
    if (attribute.empty()) {
      throw new Exception(Exception.ATTRIBUTE_NOT_FOUND);
    }

    // const projectId = project.getId();
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

        if (attribute.empty()) {
          return;
        }

        const collectionId = collection.getId();
        const key = attribute.get('key');
        const type = attribute.get('type') as AttributeType;
        const size = attribute.get('size', 0);
        const required = attribute.get('required', false);
        const defaultValue = attribute.get('default', null);
        const array = attribute.get('array', false);
        const format = attribute.get('format', '');
        const formatOptions = attribute.get('formatOptions', {});
        const filters = attribute.get('filters', []);
        const options = attribute.get('options', {});

        let relatedAttribute!: AttributesDoc;
        let relatedCollection!: CollectionsDoc;

        try {
          switch (type) {
            case AttributeType.Relationship:
              relatedCollection = await dbForProject.getDocument(
                'collections',
                options['relatedCollection'],
              );
              if (relatedCollection.empty()) {
                throw new DatabaseException(`Collection '${options['relatedCollection']}' not found`);
              }
              if (
                !(await dbForProject.createRelationship({
                  collectionId: this.getCollectionName(collection.getSequence()),
                  relatedCollectionId: this.getCollectionName(relatedCollection.getSequence()),
                  type: options['relationType'],
                  twoWay: options['twoWay'],
                  id: key,
                  twoWayKey: options['twoWayKey'],
                  onDelete: options['onDelete'],
                }))
              ) {
                throw new DatabaseException('Failed to create Attribute');
              }

              if (options['twoWay']) {
                relatedAttribute = await dbForProject.getDocument(
                  'attributes',
                  this.getRelatedAttrId(relatedCollection.getSequence(), options['twoWayKey']),
                );
                await dbForProject.updateDocument(
                  'attributes',
                  relatedAttribute.getId(),
                  relatedAttribute.set('status', Status.AVAILABLE),
                );
              }
              break;
            default:
              if (
                !(await dbForProject.createAttribute(
                  this.getCollectionName(collection.getSequence()),
                  {
                    $id: key,
                    key,
                    type,
                    size,
                    required,
                    default: defaultValue,
                    array,
                    format,
                    formatOptions,
                    filters,
                  }
                ))
              ) {
                throw new DatabaseException('Failed to create Attribute');
              }
          }

          await dbForProject.updateDocument(
            'attributes',
            attribute.getId(),
            attribute.set('status', Status.AVAILABLE),
          );
        } catch (e: any) {
          this.logger.error(e.message);
          if (e instanceof DatabaseException) {
            attribute.set('error', e.message);
            if (relatedAttribute) {
              relatedAttribute.set('error', e.message);
            }
          }

          await dbForProject.updateDocument(
            'attributes',
            attribute.getId(),
            attribute.set('status', Status.FAILED),
          );

          if (relatedAttribute) {
            await dbForProject.updateDocument(
              'attributes',
              relatedAttribute.getId(),
              relatedAttribute.set('status', Status.FAILED),
            );
          }
        } finally {
          // this.trigger(database, collection, attribute, projectDoc, projectId, events);
        }

        if (type === AttributeType.Relationship && options['twoWay']) {
          await dbForProject.purgeCachedDocument(
            `collections`,
            relatedCollection.getId(),
          );
        }

        await dbForProject.purgeCachedDocument('collections', collectionId);
      });
    } finally {
      await this.coreService.releaseDatabaseClient(client);
    }
  }

  /**
   * Deletes an attribute from the specified collection.
   * If the attribute is a relationship, it also deletes the related attribute.
   */
  private async deleteAttribute({ database, ...data }: JobData): Promise<void> {
    const collection = new Doc(data.collection);
    const attribute = new Doc(data.attribute);
    const project = new Doc(data.project);
    const { client, dbForProject } = await this.coreService.createProjectDatabase(
      project,
      { schema: database },
    );

    if (collection.empty()) {
      throw new Error('Missing collection');
    }
    if (attribute.empty()) {
      throw new Error('Missing attribute');
    }

    // const projectId = project.getId();
    // const events = Event.generateEvents('databases.[databaseId].collections.[collectionId].attributes.[attributeId].delete', {
    //   databaseId: database.getId(),
    //   collectionId: collection.getId(),
    //   attributeId: attribute.getId()
    // });

    try {
      await Authorization.skip(async () => {
        const collectionId = collection.getId();
        const key = attribute.get('key');
        const status = attribute.get('status', '');
        const type = attribute.get('type') as AttributeType;
        const options = attribute.get('options', {});

        let relatedAttribute: AttributesDoc | null = null;
        let relatedCollection: CollectionsDoc | null = null;

        try {
          if (status !== Status.FAILED) {
            if (type === AttributeType.Relationship) {
              if (options['twoWay']) {
                relatedCollection = await dbForProject.getDocument(
                  'collections',
                  options['relatedCollection'],
                );
                if (relatedCollection.empty()) {
                  throw new DatabaseException('Collection not found');
                }
                relatedAttribute = await dbForProject.getDocument(
                  'attributes',
                  this.getRelatedAttrId(relatedCollection.getSequence(), options['twoWayKey']),
                );
                if (relatedAttribute.empty()) {
                  throw new DatabaseException('Related attribute not found');
                }
              }

              if (
                !(await dbForProject.deleteRelationship(
                  this.getCollectionName(collection.getSequence()),
                  key,
                ))
              ) {
                await dbForProject.updateDocument(
                  'attributes',
                  relatedAttribute!.getId(),
                  relatedAttribute!.set('status', Status.STUCK),
                );
                throw new DatabaseException('Failed to delete Relationship');
              }
            } else if (
              !(await dbForProject.deleteAttribute(
                this.getCollectionName(collection.getSequence()),
                key,
              ))
            ) {
              throw new DatabaseException('Failed to delete Attribute');
            }
          }

          await dbForProject.deleteDocument('attributes', attribute.getId());

          if (relatedAttribute && !relatedAttribute.empty()) {
            await dbForProject.deleteDocument(
              'attributes',
              relatedAttribute.getId(),
            );
          }
        } catch (e: any) {
          this.logger.error(e.message);

          if (e instanceof DatabaseException) {
            attribute.set('error', e.message);
            if (relatedAttribute && !relatedAttribute.empty()) {
              relatedAttribute.set('error', e.message);
            }
          }
          await dbForProject.updateDocument(
            'attributes',
            attribute.getId(),
            attribute.set('status', Status.STUCK),
          );
          if (relatedAttribute && !relatedAttribute.empty()) {
            await dbForProject.updateDocument(
              'attributes',
              relatedAttribute.getId(),
              relatedAttribute.set('status', Status.STUCK),
            );
          }
        } finally {
          // this.trigger(database, collection, attribute, projectDoc, projectId, events);
        }

        const indexes = collection.get('indexes', []) as IndexesDoc[];

        for (const index of indexes) {
          const attributes = index.get('attributes');
          const orders = index.get('orders');

          const found = attributes.indexOf(key);

          if (found !== -1) {
            attributes.splice(found, 1);
            if (orders[found]) orders.splice(found, 1);

            if (attributes.length === 0) {
              await dbForProject.deleteDocument('indexes', index.getId());
            } else {
              index.set('attributes', attributes);
              index.set('orders', orders);

              let exists = false;
              for (const existing of indexes) {
                if (
                  existing.get('key') !== index.get('key') &&
                  existing.get('attributes').toString() ===
                  index.get('attributes').toString() &&
                  existing.get('orders').toString() ===
                  index.get('orders').toString()
                ) {
                  exists = true;
                  break;
                }
              }

              if (exists) {
                await this.deleteIndex(
                  {
                    database: database,
                    collection: data.collection,
                    index: index.toObject(),
                    project: data.project,
                  },
                  dbForProject,
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
          this.getCollectionName(collection.getSequence()),
        );

        if (
          relatedCollection &&
          !relatedCollection.empty() &&
          relatedAttribute &&
          !relatedAttribute.empty()
        ) {
          await dbForProject.purgeCachedDocument(
            'collections',
            relatedCollection.getId(),
          );
          await dbForProject.purgeCachedCollection(
            this.getCollectionName(relatedCollection.getSequence()),
          );
        }
      });
    } finally {
      await this.coreService.releaseDatabaseClient(client);
    }
  }

  /**
   * Creates an index in the specified collection.
   */
  private async createIndex(data: JobData): Promise<void> {
    const collection = new Doc(data.collection);
    const index = new Doc(data.index);
    const project = new Doc(data.project);

    const { client, dbForProject } = await this.coreService.createProjectDatabase(
      project,
      { schema: data.database },
    );

    if (collection.empty()) {
      throw new Error('Missing collection');
    }
    if (index.empty()) {
      throw new Error('Missing index');
    }

    // const projectId = project.getId();
    // const events = Event.generateEvents('databases.[databaseId].collections.[collectionId].indexes.[indexId].update', {
    //   databaseId: database.getId(),
    //   collectionId: collection.getId(),
    //   indexId: index.getId()
    // });

    try {
      await Authorization.skip(async () => {
        const collectionId = collection.getId();
        const key = index.get('key');
        const type = index.get('type');
        const attributes = index.get('attributes', []);
        const orders = index.get('orders', []);

        try {
          if (
            !(await dbForProject.createIndex(
              this.getCollectionName(collection.getSequence()),
              key,
              type,
              attributes,
              orders,
            ))
          ) {
            throw new DatabaseException('Failed to create Index');
          }
          await dbForProject.updateDocument(
            'indexes',
            index.getId(),
            index.set('status', Status.AVAILABLE),
          );
        } catch (e: any) {
          if (e instanceof DatabaseException) {
            index.set('error', e.message);
          }
          await dbForProject.updateDocument(
            'indexes',
            index.getId(),
            index.set('status', Status.FAILED),
          );
        } finally {
          // this.trigger(database, collection, index, projectDoc, projectId, events);
        }

        await dbForProject.purgeCachedDocument('collections', collectionId);
      });
    } finally {
      await this.coreService.releaseDatabaseClient(client);
    }
  }

  /**
   * Deletes an index from the specified collection.
   * If the index is part of a collection, it also deletes the index from the collection
   */
  private async deleteIndex({ database, ...data }: JobData, dbForProject?: Database): Promise<void> {
    const collection = new Doc(data.collection);
    const index = new Doc(data.index);
    const project = new Doc(data.project);

    let client: any = null;
    if (!dbForProject) {
      const r = await this.coreService.createProjectDatabase(
        project,
        { schema: database },
      );
      dbForProject = r.dbForProject;
      client = r.client;
    }

    if (collection.empty()) {
      throw new Error('Missing collection');
    }
    if (index.empty()) {
      throw new Error('Missing index');
    }

    // const projectId = project.getId();
    // const events = Event.generateEvents('databases.[databaseId].collections.[collectionId].indexes.[indexId].delete', {
    //   databaseId: database.getId(),
    //   collectionId: collection.getId(),
    //   indexId: index.getId()
    // });

    try {
      await Authorization.skip(async () => {
        const key = index.get('key');
        const status = index.get('status', '');

        try {
          if (
            status !== Status.FAILED &&
            !(await dbForProject.deleteIndex(
              this.getCollectionName(collection.getSequence()),
              key,
            ))
          ) {
            throw new DatabaseException('Failed to delete index');
          }
          await dbForProject.deleteDocument('indexes', index.getId());
          index.set('status', Status.DELETED);
        } catch (e: any) {
          console.error(e.message);

          if (e instanceof DatabaseException) {
            index.set('error', e.message);
          }
          await dbForProject.updateDocument(
            'indexes',
            index.getId(),
            index.set('status', Status.STUCK),
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
      await this.coreService.releaseDatabaseClient(client);
    }
  }

  /**
   * Deletes a collection and all its attributes and indexes.
   * It also deletes all relationships associated with the collection.
   */
  private async deleteCollection(data: JobData): Promise<void> {
    const project = new Doc(data.project);
    const collection = new Doc(data.collection);
    const { client, dbForProject } = await this.coreService.createProjectDatabase(
      project,
      { schema: data.database },
    );

    if (collection.empty()) {
      throw new Error('Missing collection');
    }

    try {
      await Authorization.skip(async () => {
        const collectionId = collection.getId();
        const collectionInternalId = collection.getSequence();

        const relationships = await dbForProject.find('attributes',
          (qb) =>
            qb.equal('type', AttributeType.Relationship)
              .equal('collectionInternalId', collectionInternalId)
          // TODO: will back here after json filter support
        );

        const internalCollectionName = this.getCollectionName(collectionInternalId);
        // TODO: -----------------
        for (const relationship of relationships) {
          await dbForProject.deleteRelationship(internalCollectionName, relationship.get('key'));
          if (relationship.get('options', {})['twoWay']) {
            const relatedCollectionId = relationship.get('options', {})['relatedCollection'];
            await dbForProject.deleteDocument(relatedCollectionId, relationship.get('options')['twoWayKey']);
            await dbForProject.purgeCachedDocument(
              'collections',
              relatedCollectionId,
            );
          }
        }
        await dbForProject.deleteCollection(internalCollectionName);
        await dbForProject.deleteDocuments('attributes', (qb) =>
          qb.equal('collectionInternalId', collectionInternalId)
        );
        await dbForProject.deleteDocuments('indexes', (qb) =>
          qb.equal('collectionInternalId', collectionInternalId)
        );

        await this.deleteAuditLogsByResource(
          '/collection/' + collectionId,
          project,
          dbForProject,
        );
      });
    } finally {
      await this.coreService.releaseDatabaseClient(client);
    }
  }

  private async deleteAuditLogsByResource(
    resource: string,
    project: ProjectsDoc,
    dbForProject: Database,
  ): Promise<void> {
    await this.deleteByGroup(Audit.COLLECTION, [
      Query.equal('resource', [resource])
    ], dbForProject);
  }

  private async deleteByGroup(
    collection: string,
    queries: Query[],
    database: Database,
    callback?: (document: Doc) => Promise<void>,
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
}

export enum CollectionsJob {
  CREATE_ATTRIBUTE = 'createAttribute',
  CREATE_INDEX = 'createIndex',
  DELETE_ATTRIBUTE = 'deleteAttribute',
  DELETE_INDEX = 'deleteIndex',
  DELETE_COLLECTION = 'deleteCollection',
  DELETE_SCHEMA = 'deleteSchema'
}

export type CollectionsJobData = {
  database: string;
  collection: CollectionsDoc;
  attribute?: AttributesDoc;
  index?: IndexesDoc;
  project: ProjectsDoc;
};

type JobData = {
  database: string;
  collection: Collections;
  attribute?: Attributes;
  index?: Indexes;
  project: Projects;
};

export enum Status {
  AVAILABLE = 'available',
  FAILED = 'failed',
  STUCK = 'stuck',
  DELETED = 'deleted',
  DELETING = 'deleting',
  PENDING = 'pending',
}
