import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  Authorization,
  AuthorizationException,
  Database,
  Document,
  DuplicateException,
  ID,
  IndexValidator,
  LimitException,
  Permission,
  Query,
  QueryException,
  RangeValidator,
  Structure,
  StructureException,
  TextValidator,
  TruncateException,
} from '@nuvix/database';
import {
  APP_DATABASE_ATTRIBUTE_EMAIL,
  APP_DATABASE_ATTRIBUTE_ENUM,
  APP_DATABASE_ATTRIBUTE_FLOAT_RANGE,
  APP_DATABASE_ATTRIBUTE_INT_RANGE,
  APP_DATABASE_ATTRIBUTE_IP,
  APP_DATABASE_ATTRIBUTE_URL,
  APP_LIMIT_COUNT,
  DB_FOR_CONSOLE,
  DB_FOR_PROJECT,
  GEO_DB,
} from 'src/Utils/constants';
import { CreateDatabaseDTO, UpdateDatabaseDTO } from './DTO/database.dto';
import collections from 'src/core/collections';
import { Exception } from 'src/core/extend/exception';
import { Detector } from 'src/core/helper/detector.helper';
import { CountryResponse, Reader } from 'maxmind';
import { CreateCollectionDTO, UpdateCollectionDTO } from './DTO/collection.dto';
import { Auth } from 'src/core/helper/auth.helper';
import {
  CreateBooleanAttributeDTO,
  CreateDatetimeAttributeDTO,
  CreateEmailAttributeDTO,
  CreateEnumAttributeDTO,
  CreateFloatAttributeDTO,
  CreateIntegerAttributeDTO,
  CreateIpAttributeDTO,
  CreateRelationAttributeDTO,
  CreateStringAttributeDTO,
  UpdateBooleanAttributeDTO,
  UpdateDatetimeAttributeDTO,
  UpdateEmailAttributeDTO,
  UpdateEnumAttributeDTO,
  UpdateFloatAttributeDTO,
  UpdateIntegerAttributeDTO,
  UpdateIpAttributeDTO,
  UpdateRelationAttributeDTO,
  UpdateStringAttributeDTO,
  UpdateURLAttributeDTO,
} from './DTO/attributes.dto';
import { CreateDocumentDTO, UpdateDocumentDTO } from './DTO/document.dto';
import { DatabaseQueue } from 'src/core/resolver/queues/database.queue';
import { CreateIndexDTO } from './DTO/indexes.dto';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    @Inject(DB_FOR_CONSOLE) private readonly dbConsole: Database,
    @Inject(DB_FOR_PROJECT) private readonly db: Database,
    @Inject(GEO_DB) private readonly geoDb: Reader<CountryResponse>,
  ) { }

  /**
   * Create a new database.
   */
  async create(createDatabaseDto: CreateDatabaseDTO) {
    const { databaseId: id, name, enabled } = createDatabaseDto;
    const databaseId = id === 'unique()' ? ID.unique() : id;

    try {
      await this.db.createDocument(
        'databases',
        new Document({
          $id: databaseId,
          name,
          enabled: enabled ?? true,
          search: `${databaseId} ${name}`,
        }),
      );

      const database = await this.db.getDocument('databases', databaseId);

      const _collections = ((collections['databases'] ?? {})['collections'] ??
        []) as any[];
      if (_collections.length === 0) {
        throw new Exception(
          Exception.GENERAL_SERVER_ERROR,
          'The "collections" collection is not configured.',
        );
      }

      const attributes = _collections['attributes'].map(
        (attribute: any) =>
          new Document({
            $id: attribute['$id'],
            type: attribute['type'],
            size: attribute['size'],
            required: attribute['required'],
            signed: attribute['signed'],
            array: attribute['array'],
            filters: attribute['filters'],
            default: attribute['default'] ?? null,
            format: attribute['format'] ?? '',
          }),
      );

      const indexes = _collections['indexes'].map(
        (index: any) =>
          new Document({
            $id: index['$id'],
            type: index['type'],
            attributes: index['attributes'],
            lengths: index['lengths'],
            orders: index['orders'],
          }),
      );

      await this.db.createCollection(
        `database_${database.getInternalId()}`,
        attributes,
        indexes,
      );

      return database;
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.DATABASE_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Find all databases.
   */
  async findAll(queries: Query[], search?: string) {
    if (search) {
      queries.push(Query.search('search', search));
    }

    const cursor = queries.find((query) =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      const databaseId = cursor.getValue();
      const cursorDocument = await this.db.getDocument('databases', databaseId);

      if (!cursorDocument) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `Database '${databaseId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument);
    }

    const filterQueries = Query.groupByType(queries).filters;

    const databases = await this.db.find('databases', queries);
    const total = await this.db.count(
      'databases',
      filterQueries,
      APP_LIMIT_COUNT,
    );

    return {
      databases,
      total,
    };
  }

  /**
   * Find one database.
   */
  async findOne(id: string) {
    const database = await this.db.getDocument('databases', id);

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    return database;
  }

  async update(id: string, updateDatabaseDto: UpdateDatabaseDTO) {
    const { name, enabled } = updateDatabaseDto;
    const database = await this.db.getDocument('databases', id);

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const updatedDatabase = await this.db.updateDocument(
      'databases',
      id,
      database
        .setAttribute('name', name)
        .setAttribute('enabled', enabled)
        .setAttribute('search', `${id} ${name}`),
    );

    // Assuming you have a queue for events
    // queueForEvents.setParam('databaseId', updatedDatabase.getId());

    return updatedDatabase;
  }

  async remove(id: string) {
    const database = await this.db.getDocument('databases', id);

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    if (!(await this.db.deleteDocument('databases', id))) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to remove collection from DB',
      );
    }

    this.db.purgeCachedDocument('databases', database.getId());
    this.db.purgeCachedCollection(`databases_${database.getInternalId()}`);

    // TODO: Remove all documents from thRemove all documents from the collectione collection

    return null;
  }

  /**
   * Get logs for a database.
   */
  async getLogs(databaseId: string, queries: Query[], search?: string) {
    const database = await this.db.getDocument('databases', databaseId);

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const grouped = Query.groupByType(queries);
    const limit = grouped.limit ?? APP_LIMIT_COUNT;
    const offset = grouped.offset ?? 0;

    // const audit = new Audit(this.db);
    const resource = `database/${databaseId}`;
    const logs = []; //await audit.getLogsByResource(resource, limit, offset);

    const output = logs.map((log) => {
      const detector = new Detector(log.userAgent || 'UNKNOWN');
      detector.skipBotDetection();

      const os = detector.getOS();
      const client = detector.getClient();
      const device = detector.getDevice();

      return new Document({
        event: log.event,
        userId: log.data.userId,
        userEmail: log.data.userEmail ?? null,
        userName: log.data.userName ?? null,
        mode: log.data.mode ?? null,
        ip: log.ip,
        time: log.time,
        osCode: os.osCode,
        osName: os.osName,
        osVersion: os.osVersion,
        clientType: client.clientType,
        clientCode: client.clientCode,
        clientName: client.clientName,
        clientVersion: client.clientVersion,
        clientEngine: client.clientEngine,
        clientEngineVersion: client.clientEngineVersion,
        deviceName: device.deviceName,
        deviceBrand: device.deviceBrand,
        deviceModel: device.deviceModel,
        countryCode: this.geoDb.get(log.ip)?.country?.iso_code ?? '--',
        countryName: 'Unknown', // Placeholder, replace with actual geolocation logic
      });
    });

    return {
      total: 0, //await audit.countLogsByResource(resource),
      logs: output ?? [],
    };
  }

  /**
   * Create a new collection.
   */
  async createCollection(databaseId: string, input: CreateCollectionDTO) {
    const { name, enabled, documentSecurity } = input;
    let { collectionId, permissions } = input;

    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    permissions = Permission.aggregate(permissions);
    collectionId = collectionId === 'unique()' ? ID.unique() : collectionId;

    try {
      await this.db.createDocument(
        `database_${database.getInternalId()}`,
        new Document({
          $id: collectionId,
          databaseInternalId: database.getInternalId(),
          databaseId: databaseId,
          $permissions: permissions ?? [],
          documentSecurity: documentSecurity,
          enabled: enabled ?? true,
          name,
          search: `${collectionId} ${name}`,
        }),
      );

      const collection = await this.db.getDocument(
        `database_${database.getInternalId()}`,
        collectionId,
      );

      await this.db.createCollection(
        `database_${database.getInternalId()}_collection_${collection.getInternalId()}`,
        [],
        [],
        permissions ?? [],
        documentSecurity,
      );

      // Assuming you have a queue for events
      // queueForEvents.setContext('database', database).setParam('databaseId', databaseId).setParam('collectionId', collection.getId());

      return collection;
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.COLLECTION_ALREADY_EXISTS);
      }
      if (error instanceof LimitException) {
        throw new Exception(Exception.COLLECTION_LIMIT_EXCEEDED);
      }
      throw error;
    }
  }

  /**
   * Get collections for a database.
   */
  async getCollections(databaseId: string, queries: Query[], search?: string) {
    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    if (search) {
      queries.push(Query.search('search', search));
    }

    const cursor = queries.find((query) =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      const collectionId = cursor.getValue();
      const cursorDocument = await this.db.getDocument(
        `database_${database.getInternalId()}`,
        collectionId,
      );

      if (cursorDocument.isEmpty()) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `Collection '${collectionId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument);
    }

    const filterQueries = Query.groupByType(queries).filters;

    const collections = await this.db.find(
      `database_${database.getInternalId()}`,
      queries,
    );
    const total = await this.db.count(
      `database_${database.getInternalId()}`,
      filterQueries,
      APP_LIMIT_COUNT,
    );

    return {
      collections,
      total,
    };
  }

  /**
   * Find one collection.
   */
  async getCollection(databaseId: string, collectionId: string) {
    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await this.db.getDocument(
      `database_${database.getInternalId()}`,
      collectionId,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    return collection;
  }

  /**
   * Get logs for a collection.
   */
  async getCollectionLogs(
    databaseId: string,
    collectionId: string,
    queries: Query[],
  ) {
    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collectionDocument = await this.db.getDocument(
      `database_${database.getInternalId()}`,
      collectionId,
    );
    const collection = await this.db.getCollection(
      `database_${database.getInternalId()}_collection_${collectionDocument.getInternalId()}`,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const grouped = Query.groupByType(queries);
    const limit = grouped.limit ?? APP_LIMIT_COUNT;
    const offset = grouped.offset ?? 0;

    // const audit = new Audit(this.db);
    const resource = `database/${databaseId}/collection/${collectionId}`;
    const logs = []; //await audit.getLogsByResource(resource, limit, offset);

    const output = logs.map((log) => {
      const detector = new Detector(log.userAgent || 'UNKNOWN');
      detector.skipBotDetection();

      const os = detector.getOS();
      const client = detector.getClient();
      const device = detector.getDevice();

      return new Document({
        event: log.event,
        userId: log.data.userId,
        userEmail: log.data.userEmail ?? null,
        userName: log.data.userName ?? null,
        mode: log.data.mode ?? null,
        ip: log.ip,
        time: log.time,
        osCode: os.osCode,
        osName: os.osName,
        osVersion: os.osVersion,
        clientType: client.clientType,
        clientCode: client.clientCode,
        clientName: client.clientName,
        clientVersion: client.clientVersion,
        clientEngine: client.clientEngine,
        clientEngineVersion: client.clientEngineVersion,
        deviceName: device.deviceName,
        deviceBrand: device.deviceBrand,
        deviceModel: device.deviceModel,
        countryCode: this.geoDb.get(log.ip)?.country?.iso_code ?? '--',
        countryName: 'Unknown', // Placeholder, replace with actual geolocation logic
      });
    });

    return {
      total: 0, //await audit.countLogsByResource(resource),
      logs: output ?? [],
    };
  }

  /**
   * Update a collection.
   */
  async updateCollection(
    databaseId: string,
    collectionId: string,
    input: UpdateCollectionDTO,
  ) {
    const { name, documentSecurity } = input;
    let { permissions, enabled } = input;

    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await this.db.getDocument(
      `database_${database.getInternalId()}`,
      collectionId,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    permissions = Permission.aggregate(permissions);
    enabled = enabled ?? collection.getAttribute('enabled');

    const updatedCollection = await this.db.updateDocument(
      `database_${database.getInternalId()}`,
      collectionId,
      collection
        .setAttribute('name', name)
        .setAttribute('$permissions', permissions)
        .setAttribute('documentSecurity', documentSecurity)
        .setAttribute('enabled', enabled)
        .setAttribute('search', `${collectionId} ${name}`),
    );

    await this.db.updateCollection(
      `database_${database.getInternalId()}_collection_${collection.getInternalId()}`,
      permissions,
      documentSecurity,
    );
    // Assuming you have a queue for events
    // queueForEvents.setContext('database', database).setParam('databaseId', databaseId).setParam('collectionId', collectionId);

    return updatedCollection;
  }

  /**
   * Remove a collection.
   */
  async removeCollection(
    databaseId: string,
    collectionId: string,
    project: Document,
  ) {
    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await this.db.getDocument(
      `database_${database.getInternalId()}`,
      collectionId,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    if (
      !(await this.db.deleteDocument(
        `database_${database.getInternalId()}`,
        collectionId,
      ))
    ) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to remove collection from DB',
      );
    }

    await DatabaseQueue.deleteCollection(
      database,
      collection,
      project,
      this.db,
    );

    await this.db.purgeCachedCollection(
      `database_${database.getInternalId()}_collection_${collection.getInternalId()}`,
    );

    return null;
  }

  /**
   * Get attributes for a collection.
   */
  async getAttributes(
    databaseId: string,
    collectionId: string,
    queries: Query[],
  ) {
    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await this.db.getDocument(
      `database_${database.getInternalId()}`,
      collectionId,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const cursor = queries.find((query) =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      const attributeId = cursor.getValue();
      const cursorDocument = await this.db.find('attributes', [
        Query.equal('collectionInternalId', [collection.getInternalId()]),
        Query.equal('databaseInternalId', [database.getInternalId()]),
        Query.equal('key', [attributeId]),
        Query.limit(1),
      ]);

      if (cursorDocument.length === 0 || cursorDocument[0].isEmpty()) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `Attribute '${attributeId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument[0]);
    }

    queries.push(
      Query.equal('collectionInternalId', [collection.getInternalId()]),
      Query.equal('databaseInternalId', [database.getInternalId()]),
    );

    const filterQueries = Query.groupByType(queries).filters;

    const attributes = await this.db.find('attributes', queries);
    const total = await this.db.count(
      'attributes',
      filterQueries,
      APP_LIMIT_COUNT,
    );

    return {
      attributes,
      total,
    };
  }

  async getDocuments(
    databaseId: string,
    collectionId: string,
    queries: Query[],
  ) {
    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      database.isEmpty() ||
      (!database.getAttribute('enabled', false) &&
        !isAPIKey &&
        !isPrivilegedUser)
    ) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await Authorization.skip(
      async () =>
        await this.db.getDocument(
          `database_${database.getInternalId()}`,
          collectionId,
        ),
    );

    if (
      collection.isEmpty() ||
      (!collection.getAttribute('enabled', false) &&
        !isAPIKey &&
        !isPrivilegedUser)
    ) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const cursor = queries.find((query) =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      const documentId = cursor.getValue();
      const cursorDocument = await Authorization.skip(
        async () =>
          await this.db.getDocument(
            `database_${database.getInternalId()}_collection_${collection.getInternalId()}`,
            documentId,
          ),
      );

      if (cursorDocument.isEmpty()) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `Document '${documentId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument);
    }

    const documents = await this.db.find(
      `database_${database.getInternalId()}_collection_${collection.getInternalId()}`,
      queries,
    );
    const total = await this.db.count(
      `database_${database.getInternalId()}_collection_${collection.getInternalId()}`,
      queries,
      APP_LIMIT_COUNT,
    );

    // Add $collectionId and $databaseId for all documents
    const processDocument = async (
      collection: Document,
      document: Document,
    ): Promise<boolean> => {
      if (document.isEmpty()) {
        return false;
      }

      document.removeAttribute('$collection');
      document.setAttribute('$databaseId', database.getId());
      document.setAttribute('$collectionId', collection.getId());

      const relationships = collection
        .getAttribute('attributes', [])
        .filter(
          (attribute: any) =>
            attribute.getAttribute('type') === Database.VAR_RELATIONSHIP,
        );

      for (const relationship of relationships) {
        const related = document.getAttribute(relationship.getAttribute('key'));

        if (!related) {
          continue;
        }

        const relations = Array.isArray(related) ? related : [related];
        const relatedCollectionId =
          relationship.getAttribute('relatedCollection');
        const relatedCollection = await Authorization.skip(
          async () =>
            await this.db.getDocument(
              `database_${database.getInternalId()}`,
              relatedCollectionId,
            ),
        );

        for (let i = 0; i < relations.length; i++) {
          if (relations[i] instanceof Document) {
            if (!processDocument(relatedCollection, relations[i])) {
              relations.splice(i, 1);
              i--;
            }
          }
        }

        document.setAttribute(
          relationship.getAttribute('key'),
          Array.isArray(related) ? relations : relations[0] || null,
        );
      }

      return true;
    };

    for (const document of documents) {
      await processDocument(collection, document);
    }

    const select = queries.some(
      (query) => query.getMethod() === Query.TYPE_SELECT,
    );

    // Check if the SELECT query includes $databaseId and $collectionId
    const hasDatabaseId =
      select &&
      queries.some(
        (query) =>
          query.getMethod() === Query.TYPE_SELECT &&
          query.getValues().includes('$databaseId'),
      );
    const hasCollectionId =
      select &&
      queries.some(
        (query) =>
          query.getMethod() === Query.TYPE_SELECT &&
          query.getValues().includes('$collectionId'),
      );

    if (select) {
      for (const document of documents) {
        if (!hasDatabaseId) {
          document.removeAttribute('$databaseId');
        }
        if (!hasCollectionId) {
          document.removeAttribute('$collectionId');
        }
      }
    }

    return {
      total,
      documents,
    };
  }

  /**
   * Create string attribute.
   */
  async createStringAttribute(
    databaseId: string,
    collectionId: string,
    input: CreateStringAttributeDTO,
  ) {
    const {
      key,
      size,
      required,
      default: defaultValue,
      array,
      encrypt,
    } = input;

    const validator = new TextValidator(size, 0);
    if (defaultValue !== null && !validator.isValid(defaultValue)) {
      throw new Exception(
        Exception.ATTRIBUTE_VALUE_INVALID,
        validator.getDescription(),
      );
    }

    const filters = [];
    if (encrypt) {
      filters.push('encrypt');
    }

    const attribute = new Document({
      key,
      type: Database.VAR_STRING,
      size,
      required,
      default: defaultValue,
      array,
      filters,
    });

    return await this.createAttribute(databaseId, collectionId, attribute);
  }

  /**
   * Create email attribute.
   */
  async createEmailAttribute(
    databaseId: string,
    collectionId: string,
    input: CreateEmailAttributeDTO,
  ) {
    const { key, required, default: defaultValue, array } = input;

    const attribute = new Document({
      key,
      type: Database.VAR_STRING,
      size: 254,
      required,
      default: defaultValue,
      array,
      format: APP_DATABASE_ATTRIBUTE_EMAIL,
    });

    return await this.createAttribute(databaseId, collectionId, attribute);
  }

  /**
   * Create enum attribute.
   */
  async createEnumAttribute(
    databaseId: string,
    collectionId: string,
    input: CreateEnumAttributeDTO,
  ) {
    const { key, required, default: defaultValue, array, elements } = input;

    if (defaultValue !== null && !elements.includes(defaultValue)) {
      throw new Exception(
        Exception.ATTRIBUTE_VALUE_INVALID,
        'Default value not found in elements',
      );
    }

    const attribute = new Document({
      key,
      type: Database.VAR_STRING,
      size: Database.LENGTH_KEY,
      required,
      default: defaultValue,
      array,
      format: APP_DATABASE_ATTRIBUTE_ENUM,
      formatOptions: { elements },
    });

    return await this.createAttribute(databaseId, collectionId, attribute);
  }

  /**
   * Create IP attribute.
   */
  async createIPAttribute(
    databaseId: string,
    collectionId: string,
    input: CreateIpAttributeDTO,
  ) {
    const { key, required, default: defaultValue, array } = input;

    const attribute = new Document({
      key,
      type: Database.VAR_STRING,
      size: 39,
      required,
      default: defaultValue,
      array,
      format: APP_DATABASE_ATTRIBUTE_IP,
    });

    return await this.createAttribute(databaseId, collectionId, attribute);
  }

  /**
   * Create URL attribute.
   */
  async createURLAttribute(
    databaseId: string,
    collectionId: string,
    input: CreateStringAttributeDTO,
  ) {
    const { key, required, default: defaultValue, array } = input;

    const attribute = new Document({
      key,
      type: Database.VAR_STRING,
      size: 2000,
      required,
      default: defaultValue,
      array,
      format: APP_DATABASE_ATTRIBUTE_URL,
    });

    return await this.createAttribute(databaseId, collectionId, attribute);
  }

  /**
   * Create integer attribute.
   */
  async createIntegerAttribute(
    databaseId: string,
    collectionId: string,
    input: CreateIntegerAttributeDTO,
  ) {
    const { key, required, default: defaultValue, array, min, max } = input;

    const minValue = min ?? Number.MIN_SAFE_INTEGER;
    const maxValue = max ?? Number.MAX_SAFE_INTEGER;

    if (minValue > maxValue) {
      throw new Exception(
        Exception.ATTRIBUTE_VALUE_INVALID,
        'Minimum value must be lesser than maximum value',
      );
    }

    const validator = new RangeValidator(minValue, maxValue, 'integer');

    if (defaultValue !== null && !validator.isValid(defaultValue)) {
      throw new Exception(
        Exception.ATTRIBUTE_VALUE_INVALID,
        validator.getDescription(),
      );
    }

    const size = maxValue > 2147483647 ? 8 : 4; // Automatically create BigInt depending on max value

    let attribute = new Document({
      key,
      type: Database.VAR_INTEGER,
      size,
      required,
      default: defaultValue,
      array,
      format: APP_DATABASE_ATTRIBUTE_INT_RANGE,
      formatOptions: {
        min: minValue,
        max: maxValue,
      },
    });

    attribute = await this.createAttribute(databaseId, collectionId, attribute);

    const formatOptions = attribute.getAttribute('formatOptions', {});

    if (formatOptions) {
      attribute.setAttribute('min', parseInt(formatOptions.min));
      attribute.setAttribute('max', parseInt(formatOptions.max));
    }

    return attribute;
  }

  /**
   * Create a float attribute.
   */
  async createFloatAttribute(
    databaseId: string,
    collectionId: string,
    input: CreateFloatAttributeDTO,
  ) {
    const { key, required, default: defaultValue, array, min, max } = input;

    const minValue = min ?? -Number.MAX_VALUE;
    const maxValue = max ?? Number.MAX_VALUE;

    if (minValue > maxValue) {
      throw new Exception(
        Exception.ATTRIBUTE_VALUE_INVALID,
        'Minimum value must be lesser than maximum value',
      );
    }

    const validator = new RangeValidator(minValue, maxValue, 'float');

    if (defaultValue !== null && !validator.isValid(defaultValue)) {
      throw new Exception(
        Exception.ATTRIBUTE_VALUE_INVALID,
        validator.getDescription(),
      );
    }

    const attribute = new Document({
      key,
      type: Database.VAR_FLOAT,
      size: 0,
      required,
      default: defaultValue,
      array,
      format: APP_DATABASE_ATTRIBUTE_FLOAT_RANGE,
      formatOptions: {
        min: minValue,
        max: maxValue,
      },
    });

    const createdAttribute = await this.createAttribute(
      databaseId,
      collectionId,
      attribute,
    );

    const formatOptions = createdAttribute.getAttribute('formatOptions', {});

    if (formatOptions) {
      createdAttribute.setAttribute('min', parseFloat(formatOptions.min));
      createdAttribute.setAttribute('max', parseFloat(formatOptions.max));
    }

    return createdAttribute;
  }

  /**
   * Create a boolean attribute.
   */
  async createBooleanAttribute(
    databaseId: string,
    collectionId: string,
    input: CreateBooleanAttributeDTO,
  ) {
    const { key, required, default: defaultValue, array } = input;

    const attribute = new Document({
      key,
      type: Database.VAR_BOOLEAN,
      size: 0,
      required,
      default: defaultValue,
      array,
    });

    return await this.createAttribute(databaseId, collectionId, attribute);
  }

  /**
   * Create a date attribute.
   */
  async createDateAttribute(
    databaseId: string,
    collectionId: string,
    input: CreateDatetimeAttributeDTO,
  ) {
    const { key, required, default: defaultValue, array } = input;

    const filters = ['datetime'];

    const attribute = new Document({
      key,
      type: Database.VAR_DATETIME,
      size: 0,
      required,
      default: defaultValue,
      array,
      filters,
    });

    return await this.createAttribute(databaseId, collectionId, attribute);
  }

  /**
   * Create a relationship attribute.
   */
  async createRelationshipAttribute(
    databaseId: string,
    collectionId: string,
    input: CreateRelationAttributeDTO,
  ) {
    const { key, type, twoWay, twoWayKey, onDelete, relatedCollectionId } =
      input;

    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await this.db.getDocument(
      `database_${database.getInternalId()}`,
      collectionId,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const relatedCollectionDocument = await this.db.getDocument(
      `database_${database.getInternalId()}`,
      relatedCollectionId,
    );

    if (relatedCollectionDocument.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const relatedCollection = await this.db.getCollection(
      `database_${database.getInternalId()}_collection_${relatedCollectionDocument.getInternalId()}`,
    );

    if (relatedCollection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const attributes = collection.getAttribute('attributes', []);
    for (const attribute of attributes) {
      if (attribute.getAttribute('type') !== Database.VAR_RELATIONSHIP) {
        continue;
      }

      if (attribute.getId().toLowerCase() === key.toLowerCase()) {
        throw new Exception(Exception.ATTRIBUTE_ALREADY_EXISTS);
      }

      if (
        attribute.getAttribute('options')['twoWayKey'].toLowerCase() ===
        twoWayKey.toLowerCase() &&
        attribute.getAttribute('options')['relatedCollection'] ===
        relatedCollection.getId()
      ) {
        throw new Exception(
          Exception.ATTRIBUTE_ALREADY_EXISTS,
          'Attribute with the requested key already exists. Attribute keys must be unique, try again with a different key.',
        );
      }

      if (
        type === Database.RELATION_MANY_TO_MANY &&
        attribute.getAttribute('options')['relationType'] ===
        Database.RELATION_MANY_TO_MANY &&
        attribute.getAttribute('options')['relatedCollection'] ===
        relatedCollection.getId()
      ) {
        throw new Exception(
          Exception.ATTRIBUTE_ALREADY_EXISTS,
          'Creating more than one "manyToMany" relationship on the same collection is currently not permitted.',
        );
      }
    }

    const attribute = new Document({
      key,
      type: Database.VAR_RELATIONSHIP,
      size: 0,
      required: false,
      default: null,
      array: false,
      filters: [],
      options: {
        relatedCollection: relatedCollectionId,
        relationType: type,
        twoWay: twoWay,
        twoWayKey: twoWayKey,
        onDelete: onDelete,
      },
    });

    return await this.createAttribute(databaseId, collectionId, attribute);
  }

  /**
   * Get an attribute.
   */
  async getAttribute(databaseId: string, collectionId: string, key: string) {
    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await this.db.getDocument(
      `database_${database.getInternalId()}`,
      collectionId,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const attribute = await this.db.getDocument(
      'attributes',
      `${database.getInternalId()}_${collection.getInternalId()}_${key}`,
    );

    if (attribute.isEmpty()) {
      throw new Exception(Exception.ATTRIBUTE_NOT_FOUND);
    }

    const options = attribute.getAttribute('options', []);

    for (const [key, option] of Object.entries(options)) {
      attribute.setAttribute(key, option);
    }

    return attribute;
  }

  /**
   * Update an string attribute.
   */
  async updateStringAttribute(
    databaseId: string,
    collectionId: string,
    key: string,
    input: UpdateStringAttributeDTO,
  ) {
    const { size, required, default: defaultValue, newKey } = input;

    const attribute = await this.updateAttribute({
      databaseId,
      collectionId,
      key,
      type: Database.VAR_STRING,
      size,
      defaultValue,
      required,
      options: {},
      newKey,
    });

    return attribute;
  }

  /**
   * Update email attribute.
   */
  async updateEmailAttribute(
    databaseId: string,
    collectionId: string,
    key: string,
    input: UpdateEmailAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey } = input;

    const attribute = await this.updateAttribute({
      databaseId,
      collectionId,
      key,
      type: Database.VAR_STRING,
      filter: APP_DATABASE_ATTRIBUTE_EMAIL,
      defaultValue,
      required,
      options: {},
      newKey,
    });

    return attribute;
  }

  /**
   * Update enum attribute.
   */
  async updateEnumAttribute(
    databaseId: string,
    collectionId: string,
    key: string,
    input: UpdateEnumAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey, elements } = input;

    if (defaultValue !== null && !elements.includes(defaultValue)) {
      throw new Exception(
        Exception.ATTRIBUTE_VALUE_INVALID,
        'Default value not found in elements',
      );
    }

    const attribute = await this.updateAttribute({
      databaseId,
      collectionId,
      key,
      type: Database.VAR_STRING,
      filter: APP_DATABASE_ATTRIBUTE_ENUM,
      defaultValue,
      required,
      options: { elements },
      newKey,
    });

    return attribute;
  }

  /**
   * Update IP attribute.
   */
  async updateIPAttribute(
    databaseId: string,
    collectionId: string,
    key: string,
    input: UpdateIpAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey } = input;

    const attribute = await this.updateAttribute({
      databaseId,
      collectionId,
      key,
      type: Database.VAR_STRING,
      filter: APP_DATABASE_ATTRIBUTE_IP,
      defaultValue,
      required,
      options: {},
      newKey,
    });

    return attribute;
  }

  /**
   * Update URL attribute.
   */
  async updateURLAttribute(
    databaseId: string,
    collectionId: string,
    key: string,
    input: UpdateURLAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey } = input;

    const attribute = await this.updateAttribute({
      databaseId,
      collectionId,
      key,
      type: Database.VAR_STRING,
      filter: APP_DATABASE_ATTRIBUTE_URL,
      defaultValue,
      required,
      options: {},
      newKey,
    });

    return attribute;
  }

  /**
   * Update integer attribute.
   */
  async updateIntegerAttribute(
    databaseId: string,
    collectionId: string,
    key: string,
    input: UpdateIntegerAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey, min, max } = input;

    const attribute = await this.updateAttribute({
      databaseId,
      collectionId,
      key,
      type: Database.VAR_INTEGER,
      defaultValue,
      required,
      options: { min, max },
      newKey,
    });

    const formatOptions = attribute.getAttribute('formatOptions', []);

    if (formatOptions) {
      attribute.setAttribute('min', parseInt(formatOptions.min));
      attribute.setAttribute('max', parseInt(formatOptions.max));
    }

    return attribute;
  }

  /**
   * Update float attribute.
   */
  async updateFloatAttribute(
    databaseId: string,
    collectionId: string,
    key: string,
    input: UpdateFloatAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey, min, max } = input;

    const attribute = await this.updateAttribute({
      databaseId,
      collectionId,
      key,
      type: Database.VAR_FLOAT,
      defaultValue,
      required,
      options: { min, max },
      newKey,
    });

    const formatOptions = attribute.getAttribute('formatOptions', []);

    if (formatOptions) {
      attribute.setAttribute('min', parseFloat(formatOptions.min));
      attribute.setAttribute('max', parseFloat(formatOptions.max));
    }

    return attribute;
  }

  /**
   * Update boolean attribute.
   */
  async updateBooleanAttribute(
    databaseId: string,
    collectionId: string,
    key: string,
    input: UpdateBooleanAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey } = input;

    const attribute = await this.updateAttribute({
      databaseId,
      collectionId,
      key,
      type: Database.VAR_BOOLEAN,
      defaultValue,
      required,
      options: {},
      newKey,
    });

    return attribute;
  }

  /**
   * Update date attribute.
   */
  async updateDateAttribute(
    databaseId: string,
    collectionId: string,
    key: string,
    input: UpdateDatetimeAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey } = input;

    const attribute = await this.updateAttribute({
      databaseId,
      collectionId,
      key,
      type: Database.VAR_DATETIME,
      defaultValue,
      required,
      options: {},
      newKey,
    });

    return attribute;
  }

  /**
   * Update relationship attribute.
   */
  async updateRelationshipAttribute(
    databaseId: string,
    collectionId: string,
    key: string,
    input: UpdateRelationAttributeDTO,
  ) {
    const { onDelete, newKey } = input;

    const attribute = await this.updateAttribute({
      databaseId,
      collectionId,
      key,
      type: Database.VAR_RELATIONSHIP,
      options: {
        onDelete: onDelete,
      },
      newKey,
    });

    const options = attribute.getAttribute('options', []);

    for (const [key, option] of Object.entries(options)) {
      attribute.setAttribute(key, option);
    }

    return attribute;
  }

  /**
   * Create a new attribute.
   */
  async createAttribute(
    databaseId: string,
    collectionId: string,
    attribute: Document,
  ) {
    const key = attribute.getAttribute('key');
    const type = attribute.getAttribute('type', '');
    const size = attribute.getAttribute('size', 0);
    const required = attribute.getAttribute('required', true);
    const signed = attribute.getAttribute('signed', true);
    const array = attribute.getAttribute('array', false);
    const format = attribute.getAttribute('format', '');
    const formatOptions = attribute.getAttribute('formatOptions', {});
    const filters = attribute.getAttribute('filters', []);
    const defaultValue = attribute.getAttribute('default', null);
    const options = attribute.getAttribute('options', {});

    const db = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (db.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await this.db.getDocument(
      `database_${db.getInternalId()}`,
      collectionId,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    if (format && !Structure.hasFormat(format, type)) {
      throw new Exception(
        Exception.ATTRIBUTE_FORMAT_UNSUPPORTED,
        `Format ${format} not available for ${type} attributes.`,
      );
    }

    if (required && defaultValue !== null) {
      throw new Exception(
        Exception.ATTRIBUTE_DEFAULT_UNSUPPORTED,
        'Cannot set default value for required attribute',
      );
    }

    if (array && defaultValue !== null) {
      throw new Exception(
        Exception.ATTRIBUTE_DEFAULT_UNSUPPORTED,
        'Cannot set default value for array attributes',
      );
    }

    let relatedCollection: Document;
    if (type === Database.VAR_RELATIONSHIP) {
      options['side'] = Database.RELATION_SIDE_PARENT;
      relatedCollection = await this.db.getDocument(
        `database_${db.getInternalId()}`,
        options['relatedCollection'] ?? '',
      );
      if (relatedCollection.isEmpty()) {
        throw new Exception(
          Exception.COLLECTION_NOT_FOUND,
          'The related collection was not found.',
        );
      }
    }

    try {
      const newAttribute = new Document({
        $id: ID.custom(
          `${db.getInternalId()}_${collection.getInternalId()}_${key}`,
        ),
        key,
        databaseInternalId: db.getInternalId(),
        databaseId: db.getId(),
        collectionInternalId: collection.getInternalId(),
        collectionId,
        type,
        status: 'processing',
        size,
        required,
        signed,
        default: defaultValue,
        array,
        format,
        formatOptions,
        filters,
        options,
      });

      this.db.checkAttribute(collection, newAttribute);
      attribute = await this.db.createDocument('attributes', newAttribute);
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.ATTRIBUTE_ALREADY_EXISTS);
      }
      if (error instanceof LimitException) {
        throw new Exception(
          Exception.ATTRIBUTE_LIMIT_EXCEEDED,
          'Attribute limit exceeded',
        );
      }
      throw error;
    }

    this.db.purgeCachedDocument(`database_${db.getInternalId()}`, collectionId);
    this.db.purgeCachedCollection(
      `database_${db.getInternalId()}_collection_${collection.getInternalId()}`,
    );

    if (type === Database.VAR_RELATIONSHIP && options['twoWay']) {
      const twoWayKey = options['twoWayKey'];
      options['relatedCollection'] = collection.getId();
      options['twoWayKey'] = key;
      options['side'] = Database.RELATION_SIDE_CHILD;

      try {
        const twoWayAttribute = new Document({
          $id: ID.custom(
            `${db.getInternalId()}_${relatedCollection.getInternalId()}_${twoWayKey}`,
          ),
          key: twoWayKey,
          databaseInternalId: db.getInternalId(),
          databaseId: db.getId(),
          collectionInternalId: relatedCollection.getInternalId(),
          collectionId: relatedCollection.getId(),
          type,
          status: 'processing',
          size,
          required,
          signed,
          default: defaultValue,
          array,
          format,
          formatOptions,
          filters,
          options,
        });

        this.db.checkAttribute(relatedCollection, twoWayAttribute);
        await this.db.createDocument('attributes', twoWayAttribute);
      } catch (error) {
        await this.db.deleteDocument('attributes', attribute.getId());
        if (error instanceof DuplicateException) {
          throw new Exception(Exception.ATTRIBUTE_ALREADY_EXISTS);
        }
        if (error instanceof LimitException) {
          throw new Exception(
            Exception.ATTRIBUTE_LIMIT_EXCEEDED,
            'Attribute limit exceeded',
          );
        }
        throw error;
      }

      this.db.purgeCachedDocument(
        `database_${db.getInternalId()}`,
        relatedCollection.getId(),
      );
      this.db.purgeCachedCollection(
        `database_${db.getInternalId()}_collection_${relatedCollection.getInternalId()}`,
      );
    }

    await DatabaseQueue.createAttribute(
      db,
      collection,
      attribute,
      new Document(),
      this.dbConsole,
      this.db,
    );

    return attribute;
  }

  /**
   * Update an attribute.
   */
  async updateAttribute(input: {
    databaseId: string;
    collectionId: string;
    key: string;
    type: string;
    size?: number;
    filter?: string;
    defaultValue?: string | boolean | number | null;
    required?: boolean;
    min?: number;
    max?: number;
    elements?: string[];
    options: any;
    newKey?: string;
  }) {
    let {
      databaseId,
      collectionId,
      key,
      type,
      size,
      filter,
      defaultValue,
      required,
      min,
      max,
      elements,
      options = {},
      newKey,
    } = input;

    const db = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (db.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await this.db.getDocument(
      `database_${db.getInternalId()}`,
      collectionId,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    let attribute = await this.db.getDocument(
      'attributes',
      `${db.getInternalId()}_${collection.getInternalId()}_${key}`,
    );

    if (attribute.isEmpty()) {
      throw new Exception(Exception.ATTRIBUTE_NOT_FOUND);
    }

    if (attribute.getAttribute('status') !== 'available') {
      throw new Exception(Exception.ATTRIBUTE_NOT_AVAILABLE);
    }

    if (attribute.getAttribute('type') !== type) {
      throw new Exception(Exception.ATTRIBUTE_TYPE_INVALID);
    }

    if (
      attribute.getAttribute('type') === 'string' &&
      attribute.getAttribute('filter') !== filter
    ) {
      throw new Exception(Exception.ATTRIBUTE_TYPE_INVALID);
    }

    if (required && defaultValue !== undefined && defaultValue !== null) {
      throw new Exception(
        Exception.ATTRIBUTE_DEFAULT_UNSUPPORTED,
        'Cannot set default value for required attribute',
      );
    }

    if (
      attribute.getAttribute('array', false) &&
      defaultValue !== undefined &&
      defaultValue !== null
    ) {
      throw new Exception(
        Exception.ATTRIBUTE_DEFAULT_UNSUPPORTED,
        'Cannot set default value for array attributes',
      );
    }

    const collectionIdWithPrefix = `database_${db.getInternalId()}_collection_${collection.getInternalId()}`;

    attribute
      .setAttribute('default', defaultValue)
      .setAttribute('required', required);

    if (size !== undefined && size !== null) {
      attribute.setAttribute('size', size);
    }

    const formatOptions = attribute.getAttribute('formatOptions');

    switch (attribute.getAttribute('format')) {
      case APP_DATABASE_ATTRIBUTE_INT_RANGE:
      case APP_DATABASE_ATTRIBUTE_FLOAT_RANGE:
        if ((min ?? null) !== null && (max ?? null) !== null) {
          if (min > max) {
            throw new Exception(
              Exception.ATTRIBUTE_VALUE_INVALID,
              'Minimum value must be lesser than maximum value',
            );
          }

          const validator =
            attribute.getAttribute('format') ===
              APP_DATABASE_ATTRIBUTE_INT_RANGE
              ? new RangeValidator(min, max, 'integer')
              : new RangeValidator(min, max, 'float');

          if (defaultValue !== undefined && !validator.isValid(defaultValue)) {
            throw new Exception(
              Exception.ATTRIBUTE_VALUE_INVALID,
              validator.getDescription(),
            );
          }

          options = { min, max };
          attribute.setAttribute('formatOptions', options);
        }
        break;
      case APP_DATABASE_ATTRIBUTE_ENUM:
        if (!elements || elements.length === 0) {
          throw new Exception(
            Exception.ATTRIBUTE_VALUE_INVALID,
            'Enum elements must not be empty',
          );
        }

        for (const element of elements) {
          if (element.length === 0) {
            throw new Exception(
              Exception.ATTRIBUTE_VALUE_INVALID,
              'Each enum element must not be empty',
            );
          }
        }

        if (
          (defaultValue ?? null) !== null &&
          !elements.includes(defaultValue as any)
        ) {
          throw new Exception(
            Exception.ATTRIBUTE_VALUE_INVALID,
            'Default value not found in elements',
          );
        }

        options = { elements };
        attribute.setAttribute('formatOptions', options);
        break;
    }

    if (type === Database.VAR_RELATIONSHIP) {
      const primaryDocumentOptions = {
        ...attribute.getAttribute('options', {}),
        ...options,
      };
      attribute.setAttribute('options', primaryDocumentOptions);

      await this.db.updateRelationship(
        collectionIdWithPrefix,
        key,
        newKey,
        primaryDocumentOptions['onDelete'],
      );

      if (primaryDocumentOptions['twoWay']) {
        const relatedCollection = await this.db.getDocument(
          `database_${db.getInternalId()}`,
          primaryDocumentOptions['relatedCollection'],
        );

        const relatedAttribute = await this.db.getDocument(
          'attributes',
          `${db.getInternalId()}_${relatedCollection.getInternalId()}_${primaryDocumentOptions['twoWayKey']}`,
        );

        if (newKey && newKey !== key) {
          options['twoWayKey'] = newKey;
        }

        const relatedOptions = {
          ...relatedAttribute.getAttribute('options'),
          ...options,
        };
        relatedAttribute.setAttribute('options', relatedOptions);
        await this.db.updateDocument(
          'attributes',
          `${db.getInternalId()}_${relatedCollection.getInternalId()}_${primaryDocumentOptions['twoWayKey']}`,
          relatedAttribute,
        );

        this.db.purgeCachedDocument(
          `database_${db.getInternalId()}`,
          relatedCollection.getId(),
        );
      }
    } else {
      try {
        await this.db.updateAttribute({
          collection: collectionIdWithPrefix,
          id: key,
          size,
          required,
          defaultValue,
          formatOptions: options,
          newKey,
        });
      } catch (error) {
        if (error instanceof TruncateException) {
          throw new Exception(Exception.ATTRIBUTE_INVALID_RESIZE);
        }
        throw error;
      }
    }

    if (newKey && key !== newKey) {
      const original = attribute.clone();

      await this.db.deleteDocument('attributes', attribute.getId());

      attribute
        .setAttribute(
          '$id',
          `${db.getInternalId()}_${collection.getInternalId()}_${newKey}`,
        )
        .setAttribute('key', newKey);

      try {
        attribute = await this.db.createDocument('attributes', attribute);
      } catch (error) {
        attribute = await this.db.createDocument('attributes', original);
      }
    } else {
      attribute = await this.db.updateDocument(
        'attributes',
        `${db.getInternalId()}_${collection.getInternalId()}_${key}`,
        attribute,
      );
    }

    this.db.purgeCachedDocument(
      `database_${db.getInternalId()}`,
      collection.getId(),
    );

    // Assuming you have a queue for events
    // queueForEvents
    //   .setContext('collection', collection)
    //   .setContext('database', db)
    //   .setParam('databaseId', databaseId)
    //   .setParam('collectionId', collection.getId())
    //   .setParam('attributeId', attribute.getId());

    return attribute;
  }

  /**
   * Delete an attribute.
   */
  async deleteAttribute(
    databaseId: string,
    collectionId: string,
    key: string,
    project: Document,
  ) {
    const db = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (db.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await this.db.getDocument(
      `database_${db.getInternalId()}`,
      collectionId,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const attribute = await this.db.getDocument(
      'attributes',
      `${db.getInternalId()}_${collection.getInternalId()}_${key}`,
    );

    if (attribute.isEmpty()) {
      throw new Exception(Exception.ATTRIBUTE_NOT_FOUND);
    }

    // Only update status if removing available attribute
    if (attribute.getAttribute('status') === 'available') {
      await this.db.updateDocument(
        'attributes',
        attribute.getId(),
        attribute.setAttribute('status', 'deleting'),
      );
    }

    this.db.purgeCachedDocument(`database_${db.getInternalId()}`, collectionId);
    this.db.purgeCachedCollection(
      `database_${db.getInternalId()}_collection_${collection.getInternalId()}`,
    );

    if (attribute.getAttribute('type') === Database.VAR_RELATIONSHIP) {
      const options = attribute.getAttribute('options');
      if (options['twoWay']) {
        const relatedCollection = await this.db.getDocument(
          `database_${db.getInternalId()}`,
          options['relatedCollection'],
        );

        if (relatedCollection.isEmpty()) {
          throw new Exception(Exception.COLLECTION_NOT_FOUND);
        }

        const relatedAttribute = await this.db.getDocument(
          'attributes',
          `${db.getInternalId()}_${relatedCollection.getInternalId()}_${options['twoWayKey']}`,
        );

        if (relatedAttribute.isEmpty()) {
          throw new Exception(Exception.ATTRIBUTE_NOT_FOUND);
        }

        if (relatedAttribute.getAttribute('status') === 'available') {
          await this.db.updateDocument(
            'attributes',
            relatedAttribute.getId(),
            relatedAttribute.setAttribute('status', 'deleting'),
          );
        }

        this.db.purgeCachedDocument(
          `database_${db.getInternalId()}`,
          options['relatedCollection'],
        );
        this.db.purgeCachedCollection(
          `database_${db.getInternalId()}_collection_${relatedCollection.getInternalId()}`,
        );
      }
    }

    await DatabaseQueue.deleteAttribute(
      db,
      collection,
      attribute,
      project,
      this.dbConsole,
      this.db,
    );

    return null;
  }

  /**
   * Create a Index.
   */
  async createIndex(
    databaseId: string,
    collectionId: string,
    input: CreateIndexDTO,
    project: Document
  ) {
    const { key, type, attributes, orders } = input;

    const db = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (db.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await this.db.getDocument(
      `database_${db.getInternalId()}`,
      collectionId,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const count = await this.db.count(
      'indexes',
      [
        Query.equal('collectionInternalId', [collection.getInternalId()]),
        Query.equal('databaseInternalId', [db.getInternalId()]),
      ],
      61,
    );

    const limit = this.db.getLimitForIndexes();

    if (count >= limit) {
      throw new Exception(
        Exception.INDEX_LIMIT_EXCEEDED,
        'Index limit exceeded',
      );
    }

    const oldAttributes = collection
      .getAttribute('attributes')
      .map((a: any) => a.getArrayCopy());

    oldAttributes.push(
      {
        key: '$id',
        type: Database.VAR_STRING,
        status: 'available',
        required: true,
        array: false,
        default: null,
        size: 36,
      },
      {
        key: '$createdAt',
        type: Database.VAR_DATETIME,
        status: 'available',
        signed: false,
        required: false,
        array: false,
        default: null,
        size: 0,
      },
      {
        key: '$updatedAt',
        type: Database.VAR_DATETIME,
        status: 'available',
        signed: false,
        required: false,
        array: false,
        default: null,
        size: 0,
      },
    );

    const lengths: any[] = [];

    for (const [i, attribute] of attributes.entries()) {
      const attributeIndex = oldAttributes.findIndex(
        (a: any) => a.key === attribute,
      );

      if (attributeIndex === -1) {
        throw new Exception(
          Exception.ATTRIBUTE_UNKNOWN,
          `Unknown attribute: ${attribute}. Verify the attribute name or create the attribute.`,
        );
      }

      const {
        status: attributeStatus,
        type: attributeType,
        size: attributeSize,
        array: attributeArray = false,
      } = oldAttributes[attributeIndex];

      if (attributeType === Database.VAR_RELATIONSHIP) {
        throw new Exception(
          Exception.ATTRIBUTE_TYPE_INVALID,
          `Cannot create an index for a relationship attribute: ${oldAttributes[attributeIndex].key}`,
        );
      }

      if (attributeStatus !== 'available') {
        throw new Exception(
          Exception.ATTRIBUTE_NOT_AVAILABLE,
          `Attribute not available: ${oldAttributes[attributeIndex].key}`,
        );
      }

      lengths[i] = null;

      if (attributeType === Database.VAR_STRING) {
        lengths[i] = attributeSize;
      }

      if (attributeArray) {
        lengths[i] = Database.ARRAY_INDEX_LENGTH;
        orders[i] = null;
      }
    }

    let index = new Document({
      $id: ID.custom(
        `${db.getInternalId()}_${collection.getInternalId()}_${key}`,
      ),
      key,
      status: 'processing',
      databaseInternalId: db.getInternalId(),
      databaseId,
      collectionInternalId: collection.getInternalId(),
      collectionId,
      type,
      attributes,
      lengths,
      orders,
    });

    const validator = new IndexValidator(
      collection.getAttribute('attributes'),
      this.db.getAdapter().getMaxIndexLength(),
    );

    if (!validator.isValid(index)) {
      throw new Exception(Exception.INDEX_INVALID, validator.getDescription());
    }

    try {
      index = await this.db.createDocument('indexes', index);
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.INDEX_ALREADY_EXISTS);
      }
      throw error;
    }

    await this.db.purgeCachedDocument(
      `database_${db.getInternalId()}`,
      collectionId,
    );

    await DatabaseQueue.createIndex(
      db,
      collection,
      index,
      project,
      this.dbConsole,
      this.db,
    );

    return index;
  }

  /**
   * Get all indexex.
   */
  async getIndexes(databaseId: string, collectionId: string, queries: Query[]) {
    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await this.db.getDocument(
      `database_${database.getInternalId()}`,
      collectionId,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const cursor = queries.find((query) =>
      [Query.TYPE_CURSOR_AFTER, Query.TYPE_CURSOR_BEFORE].includes(
        query.getMethod(),
      ),
    );

    if (cursor) {
      const indexId = cursor.getValue();
      const cursorDocument = await Authorization.skip(
        async () =>
          await this.db.find('indexes', [
            Query.equal('collectionInternalId', [collection.getInternalId()]),
            Query.equal('databaseInternalId', [database.getInternalId()]),
            Query.equal('key', [indexId]),
            Query.limit(1),
          ]),
      );

      if (cursorDocument.length === 0 || cursorDocument[0].isEmpty()) {
        throw new Exception(
          Exception.GENERAL_CURSOR_NOT_FOUND,
          `Index '${indexId}' for the 'cursor' value not found.`,
        );
      }

      cursor.setValue(cursorDocument[0]);
    }

    queries.push(
      Query.equal('collectionInternalId', [collection.getInternalId()]),
      Query.equal('databaseInternalId', [database.getInternalId()]),
    );

    const filterQueries = Query.groupByType(queries).filters;

    const indexes = await this.db.find('indexes', queries);
    const total = await this.db.count(
      'indexes',
      filterQueries,
      APP_LIMIT_COUNT,
    );

    return {
      indexes,
      total,
    };
  }

  /**
   * Get an index.
   */
  async getIndex(databaseId: string, collectionId: string, key: string) {
    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await this.db.getDocument(
      `database_${database.getInternalId()}`,
      collectionId,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }
    const index = collection.find<any>('key', key, 'indexes');

    if (!index) {
      throw new Exception(Exception.INDEX_NOT_FOUND);
    }

    return index;
  }

  /**
   * Delete an index.
   */
  async deleteIndex(
    databaseId: string,
    collectionId: string,
    key: string,
    project: Document,
  ) {
    const db = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (db.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await this.db.getDocument(
      `database_${db.getInternalId()}`,
      collectionId,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const index = await this.db.getDocument(
      'indexes',
      `${db.getInternalId()}_${collection.getInternalId()}_${key}`,
    );

    if (index.isEmpty()) {
      throw new Exception(Exception.INDEX_NOT_FOUND);
    }

    // Only update status if removing available index
    if (index.getAttribute('status') === 'available') {
      await this.db.updateDocument(
        'indexes',
        index.getId(),
        index.setAttribute('status', 'deleting'),
      );
    }

    await this.db.purgeCachedDocument(
      `database_${db.getInternalId()}`,
      collectionId,
    );

    await DatabaseQueue.deleteIndex(
      db,
      collection,
      index,
      project,
      this.dbConsole,
      this.db,
    );

    return null;
  }

  /**
   * Create a Document.
   */
  async createDocument(
    databaseId: string,
    collectionId: string,
    input: CreateDocumentDTO,
    mode: string,
  ) {
    const { documentId, permissions } = input;

    const data =
      typeof input.data === 'string' ? JSON.parse(input.data) : input.data;

    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      database.isEmpty() ||
      (!database.getAttribute('enabled', false) &&
        !isAPIKey &&
        !isPrivilegedUser)
    ) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await Authorization.skip(
      async () =>
        await this.db.getDocument(
          `database_${database.getInternalId()}`,
          collectionId,
        ),
    );

    if (
      collection.isEmpty() ||
      (!collection.getAttribute('enabled', false) &&
        !isAPIKey &&
        !isPrivilegedUser)
    ) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const allowedPermissions = [
      Database.PERMISSION_READ,
      Database.PERMISSION_UPDATE,
      Database.PERMISSION_DELETE,
    ];

    const aggregatedPermissions = Permission.aggregate(
      permissions,
      allowedPermissions,
    );

    if (!aggregatedPermissions) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    data['$collection'] = collection.getId();
    data['$id'] = documentId === 'unique()' ? ID.unique() : documentId;
    data['$permissions'] = aggregatedPermissions;

    const document = new Document(data);

    const checkPermissions = async (
      collection: Document,
      document: Document,
      permission: string,
    ) => {
      const documentSecurity = collection.getAttribute(
        'documentSecurity',
        false,
      );
      const validator = new Authorization(permission);

      const valid = validator.isValid(
        collection.getPermissionsByType(permission),
      );
      if (
        (permission === Database.PERMISSION_UPDATE && !documentSecurity) ||
        !valid
      ) {
        throw new Exception(Exception.USER_UNAUTHORIZED);
      }

      if (permission === Database.PERMISSION_UPDATE) {
        const validUpdate = validator.isValid(document.getUpdate());
        if (documentSecurity && !validUpdate) {
          throw new Exception(Exception.USER_UNAUTHORIZED);
        }
      }

      const relationships = collection
        .getAttribute('attributes', [])
        .filter(
          (attribute: any) =>
            attribute.getAttribute('type') === Database.VAR_RELATIONSHIP,
        );

      for (const relationship of relationships) {
        const related = document.getAttribute(relationship.getAttribute('key'));

        if (!(related ?? false)) {
          continue;
        }

        const relations = Array.isArray(related) ? related : [related];
        const relatedCollectionId =
          relationship.getAttribute('relatedCollection');
        const relatedCollection = await Authorization.skip(
          async () =>
            await this.db.getDocument(
              `database_${database.getInternalId()}`,
              relatedCollectionId,
            ),
        );

        for (let i = 0; i < relations.length; i++) {
          if (relations[i] instanceof Document) {
            const current = await Authorization.skip(
              async () =>
                await this.db.getDocument(
                  `database_${database.getInternalId()}_collection_${relatedCollection.getInternalId()}`,
                  relations[i].getId(),
                ),
            );

            if (current.isEmpty()) {
              relations[i].setAttribute('$id', ID.unique());
            } else {
              relations[i].removeAttribute('$collectionId');
              relations[i].removeAttribute('$databaseId');
              relations[i].setAttribute(
                '$collection',
                relatedCollection.getId(),
              );
            }

            await checkPermissions(
              relatedCollection,
              relations[i],
              Database.PERMISSION_CREATE,
            );
          }
        }

        document.setAttribute(
          relationship.getAttribute('key'),
          Array.isArray(related) ? relations : relations[0] || null,
        );
      }
    };

    await checkPermissions(collection, document, Database.PERMISSION_CREATE);

    try {
      const createdDocument = await this.db.createDocument(
        `database_${database.getInternalId()}_collection_${collection.getInternalId()}`,
        document,
      );

      const processDocument = async (
        collection: Document,
        document: Document,
      ): Promise<void> => {
        document.setAttribute('$databaseId', database.getId());
        document.setAttribute('$collectionId', collection.getId());

        const relationships = collection
          .getAttribute('attributes', [])
          .filter(
            (attribute: any) =>
              attribute.getAttribute('type') === Database.VAR_RELATIONSHIP,
          );

        for (const relationship of relationships) {
          const related = document.getAttribute(
            relationship.getAttribute('key'),
          );

          if (!related) {
            continue;
          }

          const relations = Array.isArray(related) ? related : [related];
          const relatedCollectionId =
            relationship.getAttribute('relatedCollection');
          const relatedCollection = await Authorization.skip(
            async () =>
              await this.db.getDocument(
                `database_${database.getInternalId()}`,
                relatedCollectionId,
              ),
          );

          for (const relation of relations) {
            if (relation instanceof Document) {
              await processDocument(relatedCollection, relation);
            }
          }
        }
      };

      await processDocument(collection, createdDocument);

      return createdDocument;
    } catch (error) {
      if (error instanceof StructureException) {
        throw new Exception(
          Exception.DOCUMENT_INVALID_STRUCTURE,
          error.message,
        );
      }
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.DOCUMENT_ALREADY_EXISTS);
      }
      throw error;
    }
  }

  /**
   * Get a document.
   */
  async getDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    queries: Query[],
  ) {
    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      database.isEmpty() ||
      (!database.getAttribute('enabled', false) &&
        !isAPIKey &&
        !isPrivilegedUser)
    ) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await Authorization.skip(
      async () =>
        await this.db.getDocument(
          `database_${database.getInternalId()}`,
          collectionId,
        ),
    );

    if (
      collection.isEmpty() ||
      (!collection.getAttribute('enabled', false) &&
        !isAPIKey &&
        !isPrivilegedUser)
    ) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    try {
      const document = await this.db.getDocument(
        `database_${database.getInternalId()}_collection_${collection.getInternalId()}`,
        documentId,
        queries,
      );

      if (document.isEmpty()) {
        throw new Exception(Exception.DOCUMENT_NOT_FOUND);
      }

      const processDocument = async (
        collection: Document,
        document: Document,
      ): Promise<void> => {
        document.setAttribute('$databaseId', database.getId());
        document.setAttribute('$collectionId', collection.getId());

        const relationships = collection
          .getAttribute('attributes', [])
          .filter(
            (attribute: any) =>
              attribute.getAttribute('type') === Database.VAR_RELATIONSHIP,
          );

        for (const relationship of relationships) {
          const related = document.getAttribute(
            relationship.getAttribute('key'),
          );

          if (!related) {
            continue;
          }

          const relations = Array.isArray(related) ? related : [related];
          const relatedCollectionId =
            relationship.getAttribute('relatedCollection');
          const relatedCollection = await Authorization.skip(
            async () =>
              await this.db.getDocument(
                `database_${database.getInternalId()}`,
                relatedCollectionId,
              ),
          );

          for (const relation of relations) {
            if (relation instanceof Document) {
              await processDocument(relatedCollection, relation);
            }
          }
        }
      };

      await processDocument(collection, document);

      return document;
    } catch (error) {
      if (error instanceof AuthorizationException) {
        throw new Exception(Exception.USER_UNAUTHORIZED);
      }
      if (error instanceof QueryException) {
        throw new Exception(Exception.GENERAL_QUERY_INVALID, error.message);
      }
      throw error;
    }
  }

  /**
   * Get document logs.
   */
  async getDocumentLogs(
    databaseId: string,
    collectionId: string,
    documentId: string,
    queries: Query[],
  ) {
    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await this.db.getDocument(
      `database_${database.getInternalId()}`,
      collectionId,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const document = await this.db.getDocument(
      `database_${database.getInternalId()}_collection_${collection.getInternalId()}`,
      documentId,
    );

    if (document.isEmpty()) {
      throw new Exception(Exception.DOCUMENT_NOT_FOUND);
    }

    const grouped = Query.groupByType(queries);
    const limit = grouped.limit ?? APP_LIMIT_COUNT;
    const offset = grouped.offset ?? 0;

    // const audit = new Audit(this.db);
    const resource = `database/${databaseId}/collection/${collectionId}/document/${document.getId()}`;
    const logs = []; //await audit.getLogsByResource(resource, limit, offset);

    const output = logs.map((log) => {
      const detector = new Detector(log.userAgent || 'UNKNOWN');
      detector.skipBotDetection();

      const os = detector.getOS();
      const client = detector.getClient();
      const device = detector.getDevice();

      return new Document({
        event: log.event,
        userId: log.data.userId,
        userEmail: log.data.userEmail ?? null,
        userName: log.data.userName ?? null,
        mode: log.data.mode ?? null,
        ip: log.ip,
        time: log.time,
        osCode: os.osCode,
        osName: os.osName,
        osVersion: os.osVersion,
        clientType: client.clientType,
        clientCode: client.clientCode,
        clientName: client.clientName,
        clientVersion: client.clientVersion,
        clientEngine: client.clientEngine,
        clientEngineVersion: client.clientEngineVersion,
        deviceName: device.deviceName,
        deviceBrand: device.deviceBrand,
        deviceModel: device.deviceModel,
        countryCode: this.geoDb.get(log.ip)?.country?.iso_code ?? '--',
        countryName: 'Unknown', // Placeholder, replace with actual geolocation logic
      });
    });

    return {
      total: 0, //await audit.countLogsByResource(resource),
      logs: output ?? [],
    };
  }

  /**
   * Update a document.
   */
  async updateDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    input: UpdateDocumentDTO,
    mode: string,
  ) {
    const { data, permissions } = input;

    if (!data && !permissions) {
      throw new Exception(Exception.DOCUMENT_MISSING_PAYLOAD);
    }

    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      database.isEmpty() ||
      (!database.getAttribute('enabled', false) &&
        !isAPIKey &&
        !isPrivilegedUser)
    ) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await Authorization.skip(
      async () =>
        await this.db.getDocument(
          `database_${database.getInternalId()}`,
          collectionId,
        ),
    );

    if (
      collection.isEmpty() ||
      (!collection.getAttribute('enabled', false) &&
        !isAPIKey &&
        !isPrivilegedUser)
    ) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const document = await Authorization.skip(
      async () =>
        await this.db.getDocument(
          `database_${database.getInternalId()}_collection_${collection.getInternalId()}`,
          documentId,
        ),
    );

    if (document.isEmpty()) {
      throw new Exception(Exception.DOCUMENT_NOT_FOUND);
    }

    const aggregatedPermissions = Permission.aggregate(permissions, [
      Database.PERMISSION_READ,
      Database.PERMISSION_UPDATE,
      Database.PERMISSION_DELETE,
    ]);

    if (!aggregatedPermissions) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    data['$id'] = documentId;
    data['$permissions'] = aggregatedPermissions;

    const newDocument = new Document(data);

    const setCollection = async (
      collection: Document,
      document: Document,
    ): Promise<void> => {
      const relationships = collection
        .getAttribute('attributes', [])
        .filter(
          (attribute: any) =>
            attribute.getAttribute('type') === Database.VAR_RELATIONSHIP,
        );

      for (const relationship of relationships) {
        const related = document.getAttribute(relationship.getAttribute('key'));

        if (!related) {
          continue;
        }

        const relations = Array.isArray(related) ? related : [related];
        const relatedCollectionId =
          relationship.getAttribute('relatedCollection');
        const relatedCollection = await Authorization.skip(
          async () =>
            await this.db.getDocument(
              `database_${database.getInternalId()}`,
              relatedCollectionId,
            ),
        );

        for (let i = 0; i < relations.length; i++) {
          if (relations[i] instanceof Document) {
            const oldDocument = await Authorization.skip(
              async () =>
                await this.db.getDocument(
                  `database_${database.getInternalId()}_collection_${relatedCollection.getInternalId()}`,
                  relations[i].getId(),
                ),
            );

            relations[i].removeAttribute('$collectionId');
            relations[i].removeAttribute('$databaseId');
            relations[i].setAttribute(
              '$collection',
              `database_${database.getInternalId()}_collection_${relatedCollection.getInternalId()}`,
            );

            if (oldDocument.isEmpty()) {
              if (relations[i].getAttribute('$id') === 'unique()') {
                relations[i].setAttribute('$id', ID.unique());
              }
            }

            await setCollection(relatedCollection, relations[i]);
          }
        }

        document.setAttribute(
          relationship.getAttribute('key'),
          Array.isArray(related) ? relations : relations[0] || null,
        );
      }
    };

    await setCollection(collection, newDocument);

    try {
      const updatedDocument = await this.db.updateDocument(
        `database_${database.getInternalId()}_collection_${collection.getInternalId()}`,
        document.getId(),
        newDocument,
      );

      const processDocument = async (
        collection: Document,
        document: Document,
      ): Promise<void> => {
        document.setAttribute('$databaseId', database.getId());
        document.setAttribute('$collectionId', collection.getId());

        const relationships = collection
          .getAttribute('attributes', [])
          .filter(
            (attribute: any) =>
              attribute.getAttribute('type') === Database.VAR_RELATIONSHIP,
          );

        for (const relationship of relationships) {
          const related = document.getAttribute(
            relationship.getAttribute('key'),
          );

          if (!related) {
            continue;
          }

          const relations = Array.isArray(related) ? related : [related];
          const relatedCollectionId =
            relationship.getAttribute('relatedCollection');
          const relatedCollection = await Authorization.skip(
            async () =>
              await this.db.getDocument(
                `database_${database.getInternalId()}`,
                relatedCollectionId,
              ),
          );

          for (const relation of relations) {
            if (relation instanceof Document) {
              await processDocument(relatedCollection, relation);
            }
          }
        }
      };

      await processDocument(collection, updatedDocument);

      return updatedDocument;
    } catch (error) {
      if (error instanceof AuthorizationException) {
        throw new Exception(Exception.USER_UNAUTHORIZED);
      }
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.DOCUMENT_ALREADY_EXISTS);
      }
      if (error instanceof StructureException) {
        throw new Exception(
          Exception.DOCUMENT_INVALID_STRUCTURE,
          error.message,
        );
      }
      throw error;
    }
  }

  /**
   * Delete a document.
   */
  async deleteDocument(
    databaseId: string,
    collectionId: string,
    documentId: string,
    mode: string,
    timestamp: Date,
  ) {
    const database = await Authorization.skip(
      async () => await this.db.getDocument('databases', databaseId),
    );

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    if (
      database.isEmpty() ||
      (!database.getAttribute('enabled', false) &&
        !isAPIKey &&
        !isPrivilegedUser)
    ) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collection = await Authorization.skip(
      async () =>
        await this.db.getDocument(
          `database_${database.getInternalId()}`,
          collectionId,
        ),
    );

    if (
      collection.isEmpty() ||
      (!collection.getAttribute('enabled', false) &&
        !isAPIKey &&
        !isPrivilegedUser)
    ) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const document = await Authorization.skip(
      async () =>
        await this.db.getDocument(
          `database_${database.getInternalId()}_collection_${collection.getInternalId()}`,
          documentId,
        ),
    );

    if (document.isEmpty()) {
      throw new Exception(Exception.DOCUMENT_NOT_FOUND);
    }

    await this.db.withRequestTimestamp(timestamp, async () => {
      await this.db.deleteDocument(
        `database_${database.getInternalId()}_collection_${collection.getInternalId()}`,
        documentId,
      );
    });

    const processDocument = async (
      collection: Document,
      document: Document,
    ): Promise<void> => {
      document.setAttribute('$databaseId', database.getId());
      document.setAttribute('$collectionId', collection.getId());

      const relationships = collection
        .getAttribute('attributes', [])
        .filter(
          (attribute: any) =>
            attribute.getAttribute('type') === Database.VAR_RELATIONSHIP,
        );

      for (const relationship of relationships) {
        const related = document.getAttribute(relationship.getAttribute('key'));

        if (!related) {
          continue;
        }

        const relations = Array.isArray(related) ? related : [related];
        const relatedCollectionId =
          relationship.getAttribute('relatedCollection');
        const relatedCollection = await Authorization.skip(
          async () =>
            await this.db.getDocument(
              `database_${database.getInternalId()}`,
              relatedCollectionId,
            ),
        );

        for (const relation of relations) {
          if (relation instanceof Document) {
            await processDocument(relatedCollection, relation);
          }
        }
      }
    };

    await processDocument(collection, document);

    // const relationships = collection
    //   .getAttribute('attributes', [])
    //   .filter(
    //     (attribute: any) =>
    //       attribute.getAttribute('type') === Database.VAR_RELATIONSHIP,
    //   )
    //   .map((attribute: any) => attribute.getAttribute('key'));

    return {};
  }

  /**
   * Get Usage.
   */
  async getUsage(range?: string) {
    const periods = []; //Config.getParam('usage', []);
    const stats: any = {};
    const usage: any = {};
    const days = periods[range];
    const metrics = ['databases', 'collections', 'documents'];

    await Authorization.skip(async () => {
      for (const metric of metrics) {
        const result = await this.db.findOne('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', ['inf']),
        ]);

        stats[metric] = { total: result?.values?.length ?? 0 };
        const limit = days.limit;
        const period = days.period;
        const results = await this.db.find('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', [period]),
          Query.limit(limit),
          Query.orderDesc('time'),
        ]);

        stats[metric].data = {};
        for (const result of results) {
          stats[metric].data[result.getAttribute('time')] = {
            value: result.getAttribute('value'),
          };
        }
      }
    });

    const format =
      days.period === '1h' ? 'Y-m-d\\TH:00:00.000P' : 'Y-m-d\\T00:00:00.000P';

    for (const metric of metrics) {
      usage[metric] = { total: stats[metric].total, data: [] };
      let leap = Date.now() - days.limit * days.factor;
      while (leap < Date.now()) {
        leap += days.factor;
        const formatDate = new Date(leap).toISOString().split('.')[0] + 'P';
        usage[metric].data.push({
          value: stats[metric].data[formatDate]?.value ?? 0,
          date: formatDate,
        });
      }
    }

    return new Document({
      range,
      databasesTotal: usage.databases.total,
      collectionsTotal: usage.collections.total,
      documentsTotal: usage.documents.total,
      databases: usage.databases.data,
      collections: usage.collections.data,
      documents: usage.documents.data,
    });
  }

  /**
   * Get a database Usage.
   */
  async getDatabaseUsage(databaseId: string, range?: string) {
    const database = await this.db.getDocument('databases', databaseId);

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const periods = []; // Config.getParam('usage', []);
    const stats: any = {};
    const usage: any = {};
    const days = periods[range];
    const metrics = [
      `database_${database.getInternalId()}_collections`,
      `database_${database.getInternalId()}_documents`,
    ];

    await Authorization.skip(async () => {
      for (const metric of metrics) {
        const result: any = await this.db.findOne('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', ['inf']),
        ]);

        stats[metric] = { total: result?.value ?? 0 };
        const limit = days.limit;
        const period = days.period;
        const results = await this.db.find('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', [period]),
          Query.limit(limit),
          Query.orderDesc('time'),
        ]);

        stats[metric].data = {};
        for (const result of results) {
          stats[metric].data[result.getAttribute('time')] = {
            value: result.getAttribute('value'),
          };
        }
      }
    });

    const format =
      days.period === '1h' ? 'Y-m-d\\TH:00:00.000P' : 'Y-m-d\\T00:00:00.000P';

    for (const metric of metrics) {
      usage[metric] = { total: stats[metric].total, data: [] };
      let leap = Date.now() - days.limit * days.factor;
      while (leap < Date.now()) {
        leap += days.factor;
        const formatDate = new Date(leap).toISOString().split('.')[0] + 'P';
        usage[metric].data.push({
          value: stats[metric].data[formatDate]?.value ?? 0,
          date: formatDate,
        });
      }
    }

    return new Document({
      range,
      collectionsTotal: usage[metrics[0]].total,
      documentsTotal: usage[metrics[1]].total,
      collections: usage[metrics[0]].data,
      documents: usage[metrics[1]].data,
    });
  }

  /**
   * Get collection Usage.
   */
  async getCollectionUsage(
    databaseId: string,
    collectionId: string,
    range?: string,
  ) {
    const database = await this.db.getDocument('databases', databaseId);

    if (database.isEmpty()) {
      throw new Exception(Exception.DATABASE_NOT_FOUND);
    }

    const collectionDocument = await this.db.getDocument(
      `database_${database.getInternalId()}`,
      collectionId,
    );

    const collection = await this.db.getCollection(
      `database_${database.getInternalId()}_collection_${collectionDocument.getInternalId()}`,
    );

    if (collection.isEmpty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const periods = []; // Config.getParam('usage', []);
    const stats: any = {};
    const usage: any = {};
    const days = periods[range];
    const metrics = [
      `database_${database.getInternalId()}_collection_${collectionDocument.getInternalId()}_documents`,
    ];

    await Authorization.skip(async () => {
      for (const metric of metrics) {
        const result: any = await this.db.findOne('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', ['inf']),
        ]);

        stats[metric] = { total: result?.value ?? 0 };
        const limit = days.limit;
        const period = days.period;
        const results = await this.db.find('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', [period]),
          Query.limit(limit),
          Query.orderDesc('time'),
        ]);

        stats[metric].data = {};
        for (const result of results) {
          stats[metric].data[result.getAttribute('time')] = {
            value: result.getAttribute('value'),
          };
        }
      }
    });

    const format =
      days.period === '1h' ? 'Y-m-d\\TH:00:00.000P' : 'Y-m-d\\T00:00:00.000P';

    for (const metric of metrics) {
      usage[metric] = { total: stats[metric].total, data: [] };
      let leap = Date.now() - days.limit * days.factor;
      while (leap < Date.now()) {
        leap += days.factor;
        const formatDate = new Date(leap).toISOString().split('.')[0] + 'P';
        usage[metric].data.push({
          value: stats[metric].data[formatDate]?.value ?? 0,
          date: formatDate,
        });
      }
    }

    return new Document({
      range,
      documentsTotal: usage[metrics[0]].total,
      documents: usage[metrics[0]].data,
    });
  }
}
