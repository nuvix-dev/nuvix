import { Injectable, Logger } from '@nestjs/common';
import {
  Authorization,
  AuthorizationException,
  Database,
  Doc,
  DuplicateException,
  ID,
  IndexValidator,
  LimitException,
  Permission,
  Query,
  QueryException,
  RangeValidator,
  StructureValidator,
  StructureException,
  TextValidator,
  TruncateException,
  AttributeType,
  NumericType,
  RelationType,
  RelationSide,
  PermissionType,
} from '@nuvix-tech/db';
import {
  APP_LIMIT_COUNT,
  AttributeFormat,
  QueueFor,
  SchemaMeta,
  Status,
} from '@nuvix/utils';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { Auth } from '@nuvix/core/helper/auth.helper';
import { Exception } from '@nuvix/core/extend/exception';
import usageConfig from '@nuvix/core/config/usage';

// DTOs
import type {
  CreateCollectionDTO,
  UpdateCollectionDTO,
} from './DTO/collection.dto';
import type {
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
  CreateURLAttributeDTO,
} from './DTO/attributes.dto';
import type { CreateDocumentDTO, UpdateDocumentDTO } from './DTO/document.dto';
import type { CreateIndexDTO } from './DTO/indexes.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CollectionsJob,
  CollectionsJobData,
} from '@nuvix/core/resolvers/queues';
import type {
  Attributes,
  AttributesDoc,
  CollectionsDoc,
  Indexes,
  IndexesDoc,
  ProjectsDoc,
} from '@nuvix/utils/types';

@Injectable()
export class CollectionsService {
  private readonly logger = new Logger(CollectionsService.name);

  constructor(
    @InjectQueue(QueueFor.COLLECTIONS)
    private readonly collectionsQueue: Queue<
      CollectionsJobData,
      unknown,
      CollectionsJob
    >,
    private readonly event: EventEmitter2,
  ) {}

  getRelatedAttrId(collectionSequence: number, key: string): string {
    return `related_${collectionSequence}_${key}`;
  }

  getAttrId(collectionSequence: number, key: string): string {
    return `${collectionSequence}_${key}`;
  }

  /**
   * Create a new collection.
   */
  async createCollection(db: Database, input: CreateCollectionDTO) {
    const { name, enabled, documentSecurity } = input;
    let { collectionId, permissions } = input;

    permissions = Permission.aggregate(permissions) ?? [];
    collectionId = collectionId === 'unique()' ? ID.unique() : collectionId;

    try {
      await db.createDocument(
        SchemaMeta.collections,
        new Doc({
          $id: collectionId,
          $permissions: permissions ?? [],
          documentSecurity: documentSecurity,
          enabled: enabled ?? true,
          name,
          search: `${collectionId} ${name}`,
        }),
      );

      const collection = await db.getDocument(
        SchemaMeta.collections,
        collectionId,
      );

      await db.createCollection({
        id: collection.getId(),
        permissions,
        documentSecurity, // TODO: we will support enabled directly in lib, so we will pass that here also
      });

      this.event.emit(
        `schema.${db.schema}.collection.${collectionId}.created`,
        collection,
      );
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
   * Get collections for a schema.
   */
  async getCollections(db: Database, queries: Query[], search?: string) {
    if (search) {
      queries.push(Query.search('search', search));
    }

    const filterQueries = Query.groupByType(queries).filters;
    const collections = await db.find(SchemaMeta.collections, queries);
    const total = await db.count(
      SchemaMeta.collections,
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
  async getCollection(db: Database, collectionId: string) {
    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    );

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    return collection;
  }

  /**
   * Get logs for a collection.
   */
  async getCollectionLogs(
    db: Database,
    collectionId: string,
    queries: Query[],
  ) {
    // TODO: Implement collection logs
    return {
      total: 0, //await audit.countLogsByResource(resource),
      logs: [],
    };
  }

  /**
   * Update a collection.
   */
  async updateCollection(
    db: Database,
    collectionId: string,
    input: UpdateCollectionDTO,
  ) {
    const { name, documentSecurity } = input;
    let { permissions, enabled } = input;

    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    );
    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    if (permissions) {
      permissions = Permission.aggregate(permissions) ?? [];
    }
    enabled = enabled ?? collection.get('enabled');

    const updatedCollection = await db.updateDocument(
      SchemaMeta.collections,
      collectionId,
      collection
        .set('name', name)
        .set('$permissions', permissions)
        .set('documentSecurity', documentSecurity)
        .set('enabled', enabled)
        .set('search', `${collectionId} ${name}`),
    );

    await db.updateCollection({
      id: collection.getId(),
      permissions: permissions ?? collection.get('$permissions'),
      documentSecurity: documentSecurity ?? collection.get('documentSecurity'),
      // TODO: same here like in create collection
    });

    this.event.emit(
      `schema.${db.schema}.collection.${collectionId}.updated`,
      updatedCollection,
    );
    return updatedCollection;
  }

  /**
   * Remove a collection.
   */
  async removeCollection(
    db: Database,
    collectionId: string,
    project: ProjectsDoc,
  ) {
    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    );

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    if (!(await db.deleteDocument(SchemaMeta.collections, collectionId))) {
      throw new Exception(
        Exception.GENERAL_SERVER_ERROR,
        'Failed to remove collection from DB',
      );
    }

    await this.collectionsQueue.add(CollectionsJob.DELETE_COLLECTION, {
      database: db.schema,
      collection,
      project,
    });

    await db.purgeCachedCollection(collection.getId());

    return;
  }

  /**
   * Get attributes for a collection.
   */
  async getAttributes(db: Database, collectionId: string, queries: Query[]) {
    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    );

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }
    queries.push(
      Query.equal('collectionInternalId', [collection.getSequence()]),
    );

    const filterQueries = Query.groupByType(queries).filters;
    const attributes = await db.find(SchemaMeta.attributes, queries);
    const total = await db.count(
      SchemaMeta.attributes,
      filterQueries,
      APP_LIMIT_COUNT,
    );

    return {
      attributes,
      total,
    };
  }

  async getDocuments(db: Database, collectionId: string, queries: Query[]) {
    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    const collection = await Authorization.skip(() =>
      db.getDocument(SchemaMeta.collections, collectionId),
    );

    if (
      collection.empty() ||
      (!collection.get('enabled', false) && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    } // TODO: skip enabled check in lib

    const filterQueries = Query.groupByType(queries).filters;
    const documents = await db.find(collection.getId(), queries);
    const total = await db.count(
      collection.getId(),
      filterQueries,
      APP_LIMIT_COUNT,
    );

    return {
      total,
      documents,
    };
  }

  /**
   * Create string attribute.
   */
  async createStringAttribute(
    db: Database,
    collectionId: string,
    input: CreateStringAttributeDTO,
    project: ProjectsDoc,
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
    if (defaultValue !== null && !validator.$valid(defaultValue)) {
      throw new Exception(
        Exception.ATTRIBUTE_VALUE_INVALID,
        validator.$description,
      );
    }

    const filters = [];
    if (encrypt) {
      filters.push('encrypt');
    }

    const attribute = new Doc<Attributes>({
      key,
      type: AttributeType.String,
      size,
      required,
      default: defaultValue,
      array,
      filters,
    });

    return this.createAttribute(db, collectionId, attribute, project);
  }

  /**
   * Create email attribute.
   */
  async createEmailAttribute(
    db: Database,
    collectionId: string,
    input: CreateEmailAttributeDTO,
    project: ProjectsDoc,
  ) {
    const { key, required, default: defaultValue, array } = input;

    const attribute = new Doc<Attributes>({
      key,
      type: AttributeType.String,
      size: 254,
      required,
      default: defaultValue,
      array,
      format: AttributeFormat.EMAIL,
    });

    return this.createAttribute(db, collectionId, attribute, project);
  }

  /**
   * Create enum attribute.
   */
  async createEnumAttribute(
    db: Database,
    collectionId: string,
    input: CreateEnumAttributeDTO,
    project: ProjectsDoc,
  ) {
    const { key, required, default: defaultValue, array, elements } = input;

    if (defaultValue !== null && !elements?.includes(defaultValue)) {
      throw new Exception(
        Exception.ATTRIBUTE_VALUE_INVALID,
        'Default value not found in elements',
      );
    }

    const attribute = new Doc<Attributes>({
      key,
      type: AttributeType.String,
      size: Database.LENGTH_KEY,
      required,
      default: defaultValue,
      array,
      format: AttributeFormat.ENUM,
      formatOptions: { elements },
    });

    return this.createAttribute(db, collectionId, attribute, project);
  }

  /**
   * Create IP attribute.
   */
  async createIPAttribute(
    db: Database,
    collectionId: string,
    input: CreateIpAttributeDTO,
    project: ProjectsDoc,
  ) {
    const { key, required, default: defaultValue, array } = input;

    const attribute = new Doc<Attributes>({
      key,
      type: AttributeType.String,
      size: 39,
      required,
      default: defaultValue,
      array,
      format: AttributeFormat.IP,
    });

    return this.createAttribute(db, collectionId, attribute, project);
  }

  /**
   * Create URL attribute.
   */
  async createURLAttribute(
    db: Database,
    collectionId: string,
    input: CreateURLAttributeDTO,
    project: ProjectsDoc,
  ) {
    const { key, required, default: defaultValue, array } = input;

    const attribute = new Doc<Attributes>({
      key,
      type: AttributeType.String,
      size: 2000,
      required,
      default: defaultValue,
      array,
      format: AttributeFormat.URL,
    });

    return this.createAttribute(db, collectionId, attribute, project);
  }

  /**
   * Create integer attribute.
   */
  async createIntegerAttribute(
    db: Database,
    collectionId: string,
    input: CreateIntegerAttributeDTO,
    project: ProjectsDoc,
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

    const validator = new RangeValidator(
      minValue,
      maxValue,
      NumericType.INTEGER,
    );

    if (defaultValue !== null && !validator.$valid(defaultValue)) {
      throw new Exception(
        Exception.ATTRIBUTE_VALUE_INVALID,
        validator.$description,
      );
    }

    const size = maxValue > 2147483647 ? 8 : 4; // Automatically create BigInt depending on max value

    let attribute = new Doc<Attributes>({
      key,
      type: AttributeType.Integer,
      size,
      required,
      default: defaultValue,
      array,
      format: AttributeFormat.INTEGER,
      formatOptions: {
        min: minValue,
        max: maxValue,
      },
    });

    attribute = await this.createAttribute(
      db,
      collectionId,
      attribute,
      project,
    );

    const formatOptions = attribute.get('formatOptions', {});

    if (formatOptions) {
      attribute.set('min', parseInt(formatOptions['min']));
      attribute.set('max', parseInt(formatOptions['max']));
    }

    return attribute;
  }

  /**
   * Create a float attribute.
   */
  async createFloatAttribute(
    db: Database,
    collectionId: string,
    input: CreateFloatAttributeDTO,
    project: ProjectsDoc,
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

    const validator = new RangeValidator(minValue, maxValue, NumericType.FLOAT);

    if (defaultValue !== null && !validator.$valid(defaultValue)) {
      throw new Exception(
        Exception.ATTRIBUTE_VALUE_INVALID,
        validator.$description,
      );
    }

    const attribute = new Doc<Attributes>({
      key,
      type: AttributeType.Float,
      size: 0,
      required,
      default: defaultValue,
      array,
      format: AttributeFormat.FLOAT,
      formatOptions: {
        min: minValue,
        max: maxValue,
      },
    });

    const createdAttribute = await this.createAttribute(
      db,
      collectionId,
      attribute,
      project,
    );

    const formatOptions = createdAttribute.get('formatOptions', {});

    if (formatOptions) {
      createdAttribute.set('min', parseFloat(formatOptions['min']));
      createdAttribute.set('max', parseFloat(formatOptions['max']));
    }

    return createdAttribute;
  }

  /**
   * Create a boolean attribute.
   */
  async createBooleanAttribute(
    db: Database,
    collectionId: string,
    input: CreateBooleanAttributeDTO,
    project: ProjectsDoc,
  ) {
    const { key, required, default: defaultValue, array } = input;

    const attribute = new Doc<Attributes>({
      key,
      type: AttributeType.Boolean,
      size: 0,
      required,
      default: defaultValue,
      array,
    });

    return this.createAttribute(db, collectionId, attribute, project);
  }

  /**
   * Create a date attribute.
   */
  async createDateAttribute(
    db: Database,
    collectionId: string,
    input: CreateDatetimeAttributeDTO,
    project: ProjectsDoc,
  ) {
    const { key, required, default: defaultValue, array } = input;

    const attribute = new Doc<Attributes>({
      key,
      type: AttributeType.Timestamptz,
      size: 0,
      required,
      default: defaultValue,
      array,
    });

    return this.createAttribute(db, collectionId, attribute, project);
  }

  /**
   * Create a relationship attribute.
   */
  async createRelationshipAttribute(
    db: Database,
    collectionId: string,
    input: CreateRelationAttributeDTO,
    project: ProjectsDoc,
  ) {
    const { key, type, twoWay, twoWayKey, onDelete, relatedCollectionId } =
      input;

    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    );
    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const relatedCollectionDocument = await db.getDocument(
      SchemaMeta.collections,
      relatedCollectionId,
    );

    if (relatedCollectionDocument.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const relatedCollection = await db.getCollection(
      relatedCollectionDocument.getId(),
    );

    if (relatedCollection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const attributes = collection.get('attributes', []) as AttributesDoc[];

    for (const attribute of attributes) {
      if (attribute.get('type') !== AttributeType.Relationship) {
        continue;
      }

      if (attribute.get('key').toLowerCase() === key.toLowerCase()) {
        throw new Exception(Exception.ATTRIBUTE_ALREADY_EXISTS);
      }

      if (
        attribute.get('options')?.['twoWayKey']?.toLowerCase() ===
          twoWayKey?.toLowerCase() &&
        attribute.get('options')?.['relatedCollection'] ===
          relatedCollection.getId()
      ) {
        throw new Exception(
          Exception.ATTRIBUTE_ALREADY_EXISTS,
          'Attribute with the requested key already exists. Attribute keys must be unique, try again with a different key.',
        );
      }

      // TODO: in new lib its possible to create multiple many to many collections
      //  we have to review it later & remove the conditions
      if (
        type === RelationType.ManyToMany &&
        attribute.get('options')?.['relationType'] ===
          RelationType.ManyToMany &&
        attribute.get('options')?.['relatedCollection'] ===
          relatedCollection.getId()
      ) {
        throw new Exception(
          Exception.ATTRIBUTE_ALREADY_EXISTS,
          'Creating more than one "manyToMany" relationship on the same collection is currently not permitted.',
        );
      }
    }

    const attribute = new Doc<Attributes>({
      key,
      type: AttributeType.Relationship,
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

    return this.createAttribute(db, collectionId, attribute, project);
  }

  /**
   * Get an attribute.
   */
  async getAttribute(db: Database, collectionId: string, key: string) {
    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    );

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const attribute = await db.getDocument(
      SchemaMeta.attributes,
      this.getAttrId(collection.getSequence(), key),
    );

    if (attribute.empty()) {
      throw new Exception(Exception.ATTRIBUTE_NOT_FOUND);
    }

    const options = attribute.get('options', []);
    for (const [optionKey, option] of Object.entries(options)) {
      attribute.set(optionKey, option);
    }

    return attribute;
  }

  /**
   * Update an string attribute.
   */
  async updateStringAttribute(
    db: Database,
    collectionId: string,
    key: string,
    input: UpdateStringAttributeDTO,
  ) {
    const { size, required, default: defaultValue, newKey } = input;

    return this.updateAttribute({
      db,
      collectionId,
      key,
      type: AttributeType.String,
      size,
      defaultValue,
      required,
      options: {},
      newKey,
    });
  }

  /**
   * Update email attribute.
   */
  async updateEmailAttribute(
    db: Database,
    collectionId: string,
    key: string,
    input: UpdateEmailAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey } = input;

    return this.updateAttribute({
      db,
      collectionId,
      key,
      type: AttributeType.String,
      format: AttributeFormat.EMAIL,
      defaultValue,
      required,
      options: {},
      newKey,
    });
  }

  /**
   * Update enum attribute.
   */
  async updateEnumAttribute(
    db: Database,
    collectionId: string,
    key: string,
    input: UpdateEnumAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey, elements } = input;

    if (defaultValue !== null && !elements?.includes(defaultValue)) {
      throw new Exception(
        Exception.ATTRIBUTE_VALUE_INVALID,
        'Default value not found in elements',
      );
    }

    return this.updateAttribute({
      db,
      collectionId,
      key,
      type: AttributeType.String,
      format: AttributeFormat.ENUM,
      defaultValue,
      required,
      options: { elements },
      newKey,
    });
  }

  /**
   * Update IP attribute.
   */
  async updateIPAttribute(
    db: Database,
    collectionId: string,
    key: string,
    input: UpdateIpAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey } = input;

    return this.updateAttribute({
      db,
      collectionId,
      key,
      type: AttributeType.String,
      format: AttributeFormat.IP,
      defaultValue,
      required,
      options: {},
      newKey,
    });
  }

  /**
   * Update URL attribute.
   */
  async updateURLAttribute(
    db: Database,
    collectionId: string,
    key: string,
    input: UpdateURLAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey } = input;

    return this.updateAttribute({
      db,
      collectionId,
      key,
      type: AttributeType.String,
      format: AttributeFormat.URL,
      defaultValue,
      required,
      options: {},
      newKey,
    });
  }

  /**
   * Update integer attribute.
   */
  async updateIntegerAttribute(
    db: Database,
    collectionId: string,
    key: string,
    input: UpdateIntegerAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey, min, max } = input;

    const attribute = await this.updateAttribute({
      db,
      collectionId,
      key,
      type: AttributeType.Integer,
      defaultValue,
      required,
      options: { min, max },
      newKey,
    });

    const formatOptions = attribute.get('formatOptions', []);

    if (formatOptions) {
      attribute.set('min', parseInt(formatOptions['min']));
      attribute.set('max', parseInt(formatOptions['max']));
    }

    return attribute;
  }

  /**
   * Update float attribute.
   */
  async updateFloatAttribute(
    db: Database,
    collectionId: string,
    key: string,
    input: UpdateFloatAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey, min, max } = input;

    const attribute = await this.updateAttribute({
      db,
      collectionId,
      key,
      type: AttributeType.Float,
      defaultValue,
      required,
      options: { min, max },
      newKey,
    });

    const formatOptions = attribute.get('formatOptions', []);

    if (formatOptions) {
      attribute.set('min', parseFloat(formatOptions['min']));
      attribute.set('max', parseFloat(formatOptions['max']));
    }

    return attribute;
  }

  /**
   * Update boolean attribute.
   */
  async updateBooleanAttribute(
    db: Database,
    collectionId: string,
    key: string,
    input: UpdateBooleanAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey } = input;

    return this.updateAttribute({
      db,
      collectionId,
      key,
      type: AttributeType.Boolean,
      defaultValue,
      required,
      options: {},
      newKey,
    });
  }

  /**
   * Update date attribute.
   */
  async updateDateAttribute(
    db: Database,
    collectionId: string,
    key: string,
    input: UpdateDatetimeAttributeDTO,
  ) {
    const { required, default: defaultValue, newKey } = input;

    return this.updateAttribute({
      db,
      collectionId,
      key,
      type: AttributeType.Timestamptz,
      defaultValue,
      required,
      options: {},
      newKey,
    });
  }

  /**
   * Update relationship attribute.
   */
  async updateRelationshipAttribute(
    db: Database,
    collectionId: string,
    key: string,
    input: UpdateRelationAttributeDTO,
  ) {
    const { onDelete, newKey } = input;

    const attribute = await this.updateAttribute({
      db,
      collectionId,
      key,
      type: AttributeType.Relationship,
      options: {
        onDelete: onDelete,
      },
      newKey,
    });

    const options = attribute.get('options', []);
    for (const [key, option] of Object.entries(options)) {
      attribute.set(key, option);
    }

    return attribute;
  }

  /**
   * Create a new attribute.
   */
  async createAttribute(
    db: Database,
    collectionId: string,
    attribute: AttributesDoc,
    project: ProjectsDoc,
  ) {
    const key = attribute.get('key');
    const type = attribute.get('type') as AttributeType;
    const size = attribute.get('size', 0);
    const required = attribute.get('required', true);
    const array = attribute.get('array', false);
    const format = attribute.get('format', '');
    const formatOptions = attribute.get('formatOptions', {});
    const filters = attribute.get('filters', []);
    const defaultValue = attribute.get('default', null);
    const options = attribute.get('options', {});

    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    );

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    if (format && !StructureValidator.hasFormat(format, type)) {
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

    let relatedCollection!: CollectionsDoc;
    if (type === AttributeType.Relationship) {
      options['side'] = RelationSide.Parent;
      relatedCollection = await db.getDocument(
        SchemaMeta.collections,
        options['relatedCollection'] ?? '',
      );
      if (relatedCollection.empty()) {
        throw new Exception(
          Exception.COLLECTION_NOT_FOUND,
          'The related collection was not found.',
        );
      }
    }

    try {
      const newAttribute = new Doc<Attributes>({
        $id: this.getAttrId(collection.getSequence(), key),
        key,
        collectionInternalId: collection.getSequence(),
        collectionId,
        type,
        status: Status.PENDING,
        size,
        required,
        default: defaultValue,
        array,
        format,
        formatOptions,
        filters,
        options,
      });

      db.checkAttribute(collection as any, newAttribute as any);
      attribute = await db.createDocument(SchemaMeta.attributes, newAttribute);
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

    db.purgeCachedDocument(SchemaMeta.collections, collectionId);
    db.purgeCachedCollection(collection.getId());

    if (type === AttributeType.Relationship && options['twoWay']) {
      const twoWayKey = options['twoWayKey'];
      options['relatedCollection'] = collection.getId();
      options['twoWayKey'] = key;
      options['side'] = RelationSide.Child;

      try {
        const twoWayAttribute = new Doc<Attributes>({
          $id: ID.custom(
            this.getRelatedAttrId(relatedCollection.getSequence(), twoWayKey),
          ),
          key: twoWayKey,
          collectionInternalId: relatedCollection.getSequence(),
          collectionId: relatedCollection.getId(),
          type,
          status: Status.PENDING,
          size,
          required,
          default: defaultValue,
          array,
          format,
          formatOptions,
          filters,
          options,
        });

        db.checkAttribute(relatedCollection as any, twoWayAttribute as any);
        await db.createDocument(SchemaMeta.attributes, twoWayAttribute);
      } catch (error) {
        await db.deleteDocument(SchemaMeta.attributes, attribute.getId());
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

      db.purgeCachedDocument(SchemaMeta.collections, relatedCollection.getId());
      db.purgeCachedCollection(relatedCollection.getId());
    }

    await this.collectionsQueue.add(CollectionsJob.CREATE_ATTRIBUTE, {
      database: db.schema,
      collection,
      attribute,
      project,
    });

    return attribute;
  }

  /**
   * Update an attribute.
   */
  async updateAttribute({
    db,
    collectionId,
    key,
    type,
    size,
    format,
    defaultValue,
    required,
    min,
    max,
    elements,
    options = {},
    newKey,
  }: {
    db: Database;
    collectionId: string;
    key: string;
    type: string;
    size?: number;
    format?: string;
    defaultValue?: string | boolean | number | null;
    required?: boolean;
    min?: number;
    max?: number;
    elements?: string[];
    options: Record<string, any>;
    newKey?: string;
  }) {
    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    );

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    let attribute = await db.getDocument(
      SchemaMeta.attributes,
      this.getAttrId(collection.getSequence(), key),
    );

    if (attribute.empty()) {
      throw new Exception(Exception.ATTRIBUTE_NOT_FOUND);
    }

    if (attribute.get('status') !== Status.AVAILABLE) {
      throw new Exception(Exception.ATTRIBUTE_NOT_AVAILABLE);
    }

    if (attribute.get('type') !== type) {
      throw new Exception(Exception.ATTRIBUTE_TYPE_INVALID);
    }

    if (
      attribute.get('type') === AttributeType.String &&
      format &&
      attribute.get('format') !== format
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
      attribute.get('array', false) &&
      defaultValue !== undefined &&
      defaultValue !== null
    ) {
      throw new Exception(
        Exception.ATTRIBUTE_DEFAULT_UNSUPPORTED,
        'Cannot set default value for array attributes',
      );
    }

    attribute.set('default', defaultValue).set('required', required);

    if (size !== undefined && size !== null) {
      attribute.set('size', size);
    }

    switch (attribute.get('format')) {
      case AttributeFormat.INTEGER:
      case AttributeFormat.FLOAT:
        if (
          min !== undefined &&
          max !== undefined &&
          min !== null &&
          max !== null
        ) {
          if (min > max) {
            throw new Exception(
              Exception.ATTRIBUTE_VALUE_INVALID,
              'Minimum value must be lesser than maximum value',
            );
          }

          const validator =
            attribute.get('format') === AttributeFormat.INTEGER
              ? new RangeValidator(min, max, NumericType.INTEGER)
              : new RangeValidator(min, max, NumericType.FLOAT);

          if (defaultValue !== undefined && !validator.$valid(defaultValue)) {
            throw new Exception(
              Exception.ATTRIBUTE_VALUE_INVALID,
              validator.$description,
            );
          }

          options = { min, max };
          attribute.set('formatOptions', options);
        }
        break;
      case AttributeFormat.ENUM:
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
        attribute.set('formatOptions', options);
        break;
    }

    if (type === AttributeType.Relationship) {
      const primaryDocumentOptions = {
        ...attribute.get('options', {}),
        ...options,
      };
      attribute.set('options', primaryDocumentOptions);

      await db.updateRelationship({
        collectionId: collection.getId(),
        id: key,
        newKey,
        onDelete: primaryDocumentOptions['onDelete'],
      });

      if (primaryDocumentOptions['twoWay']) {
        const relatedCollection = await db.getDocument(
          SchemaMeta.collections,
          primaryDocumentOptions['relatedCollection'],
        );

        const relatedAttribute = await db.getDocument(
          SchemaMeta.attributes,
          this.getRelatedAttrId(
            relatedCollection.getSequence(),
            primaryDocumentOptions['twoWayKey'],
          ),
        );

        if (newKey && newKey !== key) {
          options['twoWayKey'] = newKey;
        }

        const relatedOptions = {
          ...relatedAttribute.get('options'),
          ...options,
        };
        relatedAttribute.set('options', relatedOptions);
        await db.updateDocument(
          SchemaMeta.attributes,
          relatedAttribute.getId(),
          relatedAttribute,
        );

        db.purgeCachedDocument(
          SchemaMeta.collections,
          relatedCollection.getId(),
        );
      }
    } else {
      try {
        await db.updateAttribute(collection.getId(), key, {
          size,
          type: type as AttributeType,
          required,
          default: defaultValue,
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

      await db.deleteDocument(SchemaMeta.attributes, attribute.getId());

      attribute
        .set('$id', this.getAttrId(collection.getSequence(), newKey))
        .set('key', newKey);

      try {
        attribute = await db.createDocument(SchemaMeta.attributes, attribute);
      } catch (error) {
        attribute = await db.createDocument(SchemaMeta.attributes, original);
      }
    } else {
      attribute = await db.updateDocument(
        SchemaMeta.attributes,
        this.getAttrId(collection.getSequence(), key),
        attribute,
      );
    }

    db.purgeCachedDocument(SchemaMeta.collections, collection.getId());

    this.event.emit(
      `schema.${db.schema}.collection.${collectionId}.attribute.${key}.updated`,
      attribute.toObject(),
    );

    return attribute;
  }

  /**
   * Delete an attribute.
   */
  async deleteAttribute(
    db: Database,
    collectionId: string,
    key: string,
    project: ProjectsDoc,
  ) {
    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    );

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const attribute = await db.getDocument(
      SchemaMeta.attributes,
      this.getAttrId(collection.getSequence(), key),
    );

    if (attribute.empty()) {
      throw new Exception(Exception.ATTRIBUTE_NOT_FOUND);
    }

    // Only update status if removing available attribute
    if (attribute.get('status') === Status.AVAILABLE) {
      await db.updateDocument(
        SchemaMeta.attributes,
        attribute.getId(),
        attribute.set('status', Status.DELETING),
      );
    }

    db.purgeCachedDocument(SchemaMeta.collections, collectionId);
    db.purgeCachedCollection(collection.getId());

    if (attribute.get('type') === AttributeType.Relationship) {
      const options = attribute.get('options');
      if (options['twoWay']) {
        const relatedCollection = await db.getDocument(
          SchemaMeta.collections,
          options['relatedCollection'],
        );

        if (relatedCollection.empty()) {
          throw new Exception(Exception.COLLECTION_NOT_FOUND);
        }

        const relatedAttribute = await db.getDocument(
          SchemaMeta.attributes,
          this.getRelatedAttrId(
            relatedCollection.getSequence(),
            options['twoWayKey'],
          ),
        );
        if (relatedAttribute.empty()) {
          throw new Exception(Exception.ATTRIBUTE_NOT_FOUND);
        }

        if (relatedAttribute.get('status') === Status.AVAILABLE) {
          await db.updateDocument(
            SchemaMeta.attributes,
            relatedAttribute.getId(),
            relatedAttribute.set('status', Status.DELETING),
          );
        }

        db.purgeCachedDocument(
          SchemaMeta.collections,
          options['relatedCollection'],
        );
        db.purgeCachedCollection(relatedCollection.getId());
      }
    }

    await this.collectionsQueue.add(CollectionsJob.DELETE_ATTRIBUTE, {
      database: db.schema,
      collection,
      attribute,
      project,
    });

    return;
  }

  /**
   * Create a Index.
   */
  async createIndex(
    db: Database,
    collectionId: string,
    input: CreateIndexDTO,
    project: ProjectsDoc,
  ) {
    const { key, type, attributes, orders } = input;

    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    );

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const count = await db.count(
      SchemaMeta.indexes,
      [Query.equal('collectionInternalId', [collection.getSequence()])],
      61,
    );

    const limit = db.getAdapter().$limitForIndexes;
    if (count >= limit) {
      throw new Exception(
        Exception.INDEX_LIMIT_EXCEEDED,
        'Index limit exceeded',
      );
    }

    const oldAttributes = (collection.get('attributes') as AttributesDoc[]).map(
      a => a.toObject(),
    );

    oldAttributes.push(
      {
        key: '$id',
        type: AttributeType.String,
        status: Status.AVAILABLE,
        required: true,
        size: 36,
      } as Attributes,
      {
        key: '$createdAt',
        type: AttributeType.Timestamptz,
        status: Status.AVAILABLE,
      } as Attributes,
      {
        key: '$updatedAt',
        type: AttributeType.Timestamptz,
        status: Status.AVAILABLE,
      } as Attributes,
    );

    for (const [i, attribute] of attributes.entries()) {
      const attributeIndex = oldAttributes.findIndex(a => a.key === attribute);

      if (attributeIndex === -1) {
        throw new Exception(
          Exception.ATTRIBUTE_UNKNOWN,
          `Unknown attribute: ${attribute}. Verify the attribute name or create the attribute.`,
        );
      }

      const {
        status: attributeStatus,
        type: attributeType,
        array: attributeArray = false,
      } = oldAttributes[attributeIndex]!;
      if (attributeType === AttributeType.Relationship) {
        throw new Exception(
          Exception.ATTRIBUTE_TYPE_INVALID,
          `Cannot create an index for a relationship attribute: ${oldAttributes[attributeIndex]!.key}`,
        );
      }

      if (attributeStatus !== Status.AVAILABLE) {
        throw new Exception(
          Exception.ATTRIBUTE_NOT_AVAILABLE,
          `Attribute not available: ${oldAttributes[attributeIndex]!.key}`,
        );
      }

      if (attributeArray) {
        orders[i] = null;
      }
    }

    let index = new Doc<Indexes>({
      $id: ID.custom(this.getAttrId(collection.getSequence(), key)),
      key,
      status: Status.PENDING,
      collectionInternalId: collection.getSequence(),
      collectionId,
      type,
      attributes,
      orders,
    });

    const validator = new IndexValidator(
      collection.get('attributes'),
      db.getAdapter().$maxIndexLength,
    );

    if (!validator.$valid(index as any)) {
      throw new Exception(Exception.INDEX_INVALID, validator.$description);
    }

    try {
      index = await db.createDocument(SchemaMeta.indexes, index);
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.INDEX_ALREADY_EXISTS);
      }
      throw error;
    }

    await db.purgeCachedDocument(SchemaMeta.collections, collectionId);

    await this.collectionsQueue.add(CollectionsJob.CREATE_INDEX, {
      database: db.schema,
      collection,
      index,
      project,
    });

    return index;
  }

  /**
   * Get all indexes.
   */
  async getIndexes(db: Database, collectionId: string, queries: Query[]) {
    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    );

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }
    queries.push(
      Query.equal('collectionInternalId', [collection.getSequence()]),
    );

    const filterQueries = Query.groupByType(queries).filters;
    const indexes = await db.find(SchemaMeta.indexes, queries);
    const total = await db.count(
      SchemaMeta.indexes,
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
  async getIndex(db: Database, collectionId: string, key: string) {
    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    );

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }
    const index = collection.findWhere(
      'indexes',
      (i: IndexesDoc) => i.get('key') === key,
    );

    if (!index) {
      throw new Exception(Exception.INDEX_NOT_FOUND);
    }

    return index;
  }

  /**
   * Delete an index.
   */
  async deleteIndex(
    db: Database,
    collectionId: string,
    key: string,
    project: ProjectsDoc,
  ) {
    const collection = await db.getDocument(
      SchemaMeta.collections,
      collectionId,
    );

    if (collection.empty()) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    }

    const index = await db.getDocument(
      SchemaMeta.indexes,
      this.getAttrId(collection.getSequence(), key),
    );

    if (index.empty()) {
      throw new Exception(Exception.INDEX_NOT_FOUND);
    }

    // Only update status if removing available index
    if (index.get('status') === Status.AVAILABLE) {
      await db.updateDocument(
        SchemaMeta.indexes,
        index.getId(),
        index.set('status', Status.DELETING),
      );
    }

    await db.purgeCachedDocument(SchemaMeta.collections, collectionId);

    await this.collectionsQueue.add(CollectionsJob.DELETE_INDEX, {
      database: db.schema,
      collection,
      index,
      project,
    });

    return;
  }

  /**
   * Create a Doc.
   */
  async createDocument(
    db: Database,
    collectionId: string,
    { documentId, permissions, data }: CreateDocumentDTO,
    mode: string,
  ) {
    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    const collection = await Authorization.skip(() =>
      db.getDocument(SchemaMeta.collections, collectionId),
    );

    if (
      collection.empty() ||
      (!collection.get('enabled', false) && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    } // TODO: disbale check is lib

    const allowedPermissions = [
      PermissionType.Read,
      PermissionType.Update,
      PermissionType.Delete,
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

    const document = new Doc(data);
    const checkPermissions = async (
      collection: CollectionsDoc,
      document: Doc,
      permission: PermissionType,
    ) => {
      const documentSecurity = collection.get('documentSecurity', false);
      const validator = new Authorization(permission);
      const valid = validator.$valid(
        collection.getPermissionsByType(permission),
      );

      if (
        (permission === PermissionType.Update && !documentSecurity) ||
        !valid
      ) {
        throw new Exception(Exception.USER_UNAUTHORIZED);
      }

      if (permission === PermissionType.Update) {
        const validUpdate = validator.$valid(document.getUpdate());
        if (documentSecurity && !validUpdate) {
          throw new Exception(Exception.USER_UNAUTHORIZED);
        }
      }
    };

    // I DON"T THINK WE NEED TO DO IT, because our lib do very well
    await checkPermissions(collection, document, PermissionType.Update);

    try {
      const createdDocument = await db.createDocument(
        collection.getId(),
        document,
      );

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
    db: Database,
    collectionId: string,
    documentId: string,
    queries: Query[],
  ) {
    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    const collection = await Authorization.skip(() =>
      db.getDocument(SchemaMeta.collections, collectionId),
    );

    if (
      collection.empty() ||
      (!collection.get('enabled', false) && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    } // TODO: disbale check in lib

    try {
      const document = await db.getDocument(
        collection.getId(),
        documentId,
        queries,
      );

      if (document.empty()) {
        throw new Exception(Exception.DOCUMENT_NOT_FOUND);
      }

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
    db: Database,
    collectionId: string,
    documentId: string,
    queries: Query[],
  ) {
    // TODO: Implement this method
    return {
      total: 0, //await audit.countLogsByResource(resource),
      logs: [],
    };
  }

  /**
   * Update a document.
   */
  async updateDocument(
    db: Database,
    collectionId: string,
    documentId: string,
    { data, permissions }: UpdateDocumentDTO,
    mode: string,
  ) {
    // TODO: permissions can be undefined and we have to make sure like is user can update permission
    // based on metadata
    if (!data && !permissions) {
      throw new Exception(Exception.DOCUMENT_MISSING_PAYLOAD);
    }

    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    const collection = await Authorization.skip(() =>
      db.getDocument(SchemaMeta.collections, collectionId),
    );

    if (
      collection.empty() ||
      (!collection.get('enabled', false) && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    } // skip enabled check in lib also

    const document = await Authorization.skip(() =>
      db.getDocument(collection.getId(), documentId),
    );

    if (document.empty()) {
      throw new Exception(Exception.DOCUMENT_NOT_FOUND);
    }

    const aggregatedPermissions = Permission.aggregate(permissions!, [
      PermissionType.Read,
      PermissionType.Update,
      PermissionType.Delete,
    ]);
    if (!aggregatedPermissions) {
      throw new Exception(Exception.USER_UNAUTHORIZED);
    }

    data!['$id'] = documentId;
    data!['$permissions'] = aggregatedPermissions;
    data!['$updatedAt'] = new Date();
    const newDocument = new Doc(data);

    try {
      const updatedDocument = await db.updateDocument(
        collection.getId(),
        document.getId(),
        newDocument,
      );

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
    db: Database,
    collectionId: string,
    documentId: string,
    mode: string,
    timestamp?: Date,
  ) {
    const isAPIKey = Auth.isAppUser(Authorization.getRoles());
    const isPrivilegedUser = Auth.isPrivilegedUser(Authorization.getRoles());

    const collection = await Authorization.skip(() =>
      db.getDocument(SchemaMeta.collections, collectionId),
    );

    if (
      collection.empty() ||
      (!collection.get('enabled', false) && !isAPIKey && !isPrivilegedUser)
    ) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND);
    } // TODO: disbale check in lib

    const document = await Authorization.skip(async () =>
      db.getDocument(collection.getId(), documentId),
    );

    if (document.empty()) {
      throw new Exception(Exception.DOCUMENT_NOT_FOUND);
    }

    await db.withRequestTimestamp(timestamp ?? null, async () =>
      db.deleteDocument(collection.getId(), documentId),
    );

    return;
  }

  /**
   * Get Usage.
   */
  async getUsage(db: Database, range: string = '7d') {
    const periods = usageConfig;
    const stats: any = {};
    const usage: any = {};
    const days = periods[range as keyof typeof periods];
    const metrics = ['collections', 'documents'];

    await Authorization.skip(async () => {
      for (const metric of metrics) {
        const result = await db.findOne('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', ['inf']),
        ]);

        stats[metric] = { total: result.get('value') };
        const limit = days.limit;
        const period = days.period;
        const results = await db.find('stats', [
          Query.equal('metric', [metric]),
          Query.equal('period', [period]),
          Query.limit(limit),
          Query.orderDesc('time'),
        ]);

        stats[metric].data = {};
        for (const result of results) {
          stats[metric].data[result.get('time') as string] = {
            value: result.get('value'),
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

    return new Doc({
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
  async getDatabaseUsage(db: Database, range?: string) {
    // const database = await db.getDocument('databases', databaseId);

    // if (database.empty()) {
    //   throw new Exception(Exception.DATABASE_NOT_FOUND);
    // }

    // const periods = usageConfig;
    // const stats: any = {};
    // const usage: any = {};
    // const days = periods[range];
    // const metrics = [
    //   `database_${database.getSequence()}_collections`,
    //   `database_${database.getSequence()}_documents`,
    // ];

    // await Authorization.skip(async () => {
    //   for (const metric of metrics) {
    //     const result: any = await db.findOne('stats', [
    //       Query.equal('metric', [metric]),
    //       Query.equal('period', ['inf']),
    //     ]);

    //     stats[metric] = { total: result?.value ?? 0 };
    //     const limit = days.limit;
    //     const period = days.period;
    //     const results = await db.find('stats', [
    //       Query.equal('metric', [metric]),
    //       Query.equal('period', [period]),
    //       Query.limit(limit),
    //       Query.orderDesc('time'),
    //     ]);

    //     stats[metric].data = {};
    //     for (const result of results) {
    //       stats[metric].data[result.get('time')] = {
    //         value: result.get('value'),
    //       };
    //     }
    //   }
    // });

    // const format =
    //   days.period === '1h' ? 'Y-m-d\\TH:00:00.000P' : 'Y-m-d\\T00:00:00.000P';

    // for (const metric of metrics) {
    //   usage[metric] = { total: stats[metric].total, data: [] };
    //   let leap = Date.now() - days.limit * days.factor;
    //   while (leap < Date.now()) {
    //     leap += days.factor;
    //     const formatDate = new Date(leap).toISOString().split('.')[0] + 'P';
    //     usage[metric].data.push({
    //       value: stats[metric].data[formatDate]?.value ?? 0,
    //       date: formatDate,
    //     });
    //   }
    // }

    // return new Doc({
    //   range,
    //   collectionsTotal: usage[metrics[0]].total,
    //   documentsTotal: usage[metrics[1]].total,
    //   collections: usage[metrics[0]].data,
    //   documents: usage[metrics[1]].data,
    // });
    return new Doc();
  }

  /**
   * Get collection Usage.
   */
  async getCollectionUsage(db: Database, collectionId: string, range?: string) {
    // const database = await db.getDocument('databases', databaseId);

    // if (database.empty()) {
    //   throw new Exception(Exception.DATABASE_NOT_FOUND);
    // }

    // const collectionDocument = await db.getDocument(
    //   SchemaMeta.collections,
    //   collectionId,
    // );

    // const collection = await db.getCollection(
    //   `database_${database.getSequence()}_collection_${collectionDocument.getSequence()}`,
    // );

    // if (collection.empty()) {
    //   throw new Exception(Exception.COLLECTION_NOT_FOUND);
    // }

    // const periods = usageConfig;
    // const stats: any = {};
    // const usage: any = {};
    // const days = periods[range];
    // const metrics = [
    //   `database_${database.getSequence()}_collection_${collectionDocument.getSequence()}_documents`,
    // ];

    // await Authorization.skip(async () => {
    //   for (const metric of metrics) {
    //     const result: any = await db.findOne('stats', [
    //       Query.equal('metric', [metric]),
    //       Query.equal('period', ['inf']),
    //     ]);

    //     stats[metric] = { total: result?.value ?? 0 };
    //     const limit = days.limit;
    //     const period = days.period;
    //     const results = await db.find('stats', [
    //       Query.equal('metric', [metric]),
    //       Query.equal('period', [period]),
    //       Query.limit(limit),
    //       Query.orderDesc('time'),
    //     ]);

    //     stats[metric].data = {};
    //     for (const result of results) {
    //       stats[metric].data[result.get('time')] = {
    //         value: result.get('value'),
    //       };
    //     }
    //   }
    // });

    // const format =
    //   days.period === '1h' ? 'Y-m-d\\TH:00:00.000P' : 'Y-m-d\\T00:00:00.000P';

    // for (const metric of metrics) {
    //   usage[metric] = { total: stats[metric].total, data: [] };
    //   let leap = Date.now() - days.limit * days.factor;
    //   while (leap < Date.now()) {
    //     leap += days.factor;
    //     const formatDate = new Date(leap).toISOString().split('.')[0] + 'P';
    //     usage[metric].data.push({
    //       value: stats[metric].data[formatDate]?.value ?? 0,
    //       date: formatDate,
    //     });
    //   }
    // }

    // return new Doc({
    //   range,
    //   documentsTotal: usage[metrics[0]].total,
    //   documents: usage[metrics[0]].data,
    // });

    return new Doc();
  }
}
