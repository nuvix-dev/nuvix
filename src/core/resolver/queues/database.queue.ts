import { Database, DatabaseError, Document, Query } from '@nuvix/database';
import { Queue } from './queue';
import { Exception } from 'src/core/extend/exception';

export class DatabaseQueue extends Queue {
  // private
  static async createAttribute(
    database: Document,
    collection: Document,
    attribute: Document,
    project: Document,
    dbForConsole: Database,
    dbForProject: Database,
  ): Promise<void> {
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

    attribute = await dbForProject.getDocument('attributes', attribute.getId());

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
              relatedAttribute.getId(),
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
        attribute.getId(),
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
        'database_' + database.getInternalId(),
        relatedCollection.getId(),
      );
    }

    await dbForProject.purgeCachedDocument(
      'database_' + database.getInternalId(),
      collectionId,
    );
  }

  static async deleteAttribute(
    database: Document,
    collection: Document,
    attribute: Document,
    project: Document,
    dbForConsole: Database,
    dbForProject: Database,
  ): Promise<void> {
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
              relatedAttribute.getId(),
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

      await dbForProject.deleteDocument('attributes', attribute.getId());

      if (relatedAttribute && !relatedAttribute.isEmpty()) {
        await dbForProject.deleteDocument(
          'attributes',
          relatedAttribute.getId(),
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
              database,
              collection,
              index,
              projectDoc,
              dbForConsole,
              dbForProject,
            );
          } else {
            await dbForProject.updateDocument('indexes', index.getId(), index);
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
  }

  static async createIndex(
    database: Document,
    collection: Document,
    index: Document,
    project: Document,
    dbForConsole: Database,
    dbForProject: Database,
  ): Promise<void> {
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
  }

  static async deleteIndex(
    database: Document,
    collection: Document,
    index: Document,
    project: Document,
    dbForConsole: Database,
    dbForProject: Database,
  ): Promise<void> {
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
  }

  static async deleteDatabase(
    database: Document,
    project: Document,
    dbForProject: Database,
  ): Promise<void> {
    const databaseId = 'database_' + database.getInternalId();

    await this.deleteByGroup(
      databaseId,
      [],
      dbForProject,
      async (collection: Document) => {
        await this.deleteCollection(
          database,
          collection,
          project,
          dbForProject,
        );
      },
    );

    await dbForProject.deleteCollection(databaseId);

    await this.deleteAuditLogsByResource(
      'database/' + database.getId(),
      project,
      dbForProject,
    );
  }

  static async deleteCollection(
    database: Document,
    collection: Document,
    project: Document,
    dbForProject: Database,
  ): Promise<void> {
    if (collection.isEmpty()) {
      throw new Error('Missing collection');
    }

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
      'database_' + databaseInternalId + '_collection_' + collectionInternalId,
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
  }

  private static async deleteAuditLogsByResource(
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

  private static async deleteByGroup(
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

  private static async trigger(
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
    //   attribute.getArrayCopy(),
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
