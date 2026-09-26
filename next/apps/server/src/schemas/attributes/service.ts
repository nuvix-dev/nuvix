import {
  type Attribute,
  AttributeType,
  type Database,
  Doc,
  DuplicateException,
  type OnDelete,
  type RelationType,
} from '@nuvix/db'
import { AttributeFormat } from '@nuvix/utils'
import { ConflictError, NotFoundError } from '../../shared/errors'

export interface CreateStringAttributeInput {
  key: string
  size?: number
  required?: boolean
  default?: string | null
  array?: boolean
  encrypt?: boolean
}

export interface CreateEmailAttributeInput {
  key: string
  required?: boolean
  default?: string | null
  array?: boolean
}

export interface CreateEnumAttributeInput {
  key: string
  elements: string[]
  required?: boolean
  default?: string | null
  array?: boolean
}

export interface CreateIpAttributeInput {
  key: string
  required?: boolean
  default?: string | null
  array?: boolean
}

export interface CreateUrlAttributeInput {
  key: string
  required?: boolean
  default?: string | null
  array?: boolean
}

export interface CreateIntegerAttributeInput {
  key: string
  min?: number
  max?: number
  required?: boolean
  default?: number | null
  array?: boolean
}

export interface CreateFloatAttributeInput {
  key: string
  min?: number
  max?: number
  required?: boolean
  default?: number | null
  array?: boolean
}

export interface CreateBooleanAttributeInput {
  key: string
  required?: boolean
  default?: boolean | null
  array?: boolean
}

export interface CreateDatetimeAttributeInput {
  key: string
  required?: boolean
  default?: string | null
  array?: boolean
}

export interface CreateRelationAttributeInput {
  key: string
  relatedCollection: string
  relationType: RelationType
  twoWay?: boolean
  twoWayKey?: string
  onDelete?: OnDelete
}

export interface UpdateAttributeInput {
  required?: boolean
  default?: unknown
  size?: number
  min?: number
  max?: number
  elements?: string[]
}

export class AttributesService {
  /**
   * Get all attributes for a collection.
   */
  async getAttributes(
    db: Database,
    collectionId: string,
  ): Promise<{ data: Doc<Attribute>[]; total: number }> {
    const collection = await db.getCollection(collectionId)
    if (collection.empty()) {
      throw new NotFoundError('Collection not found', { code: 'collection_not_found' })
    }

    const rawAttributes = (collection.get('attributes') ?? []) as Array<
      Record<string, unknown> | Doc<Attribute>
    >
    const attributes = rawAttributes.map((attr) =>
      attr instanceof Doc ? attr : new Doc<Attribute>(attr as unknown as Attribute),
    )

    return {
      data: attributes,
      total: attributes.length,
    }
  }

  /**
   * Get a single attribute by key.
   */
  async getAttribute(db: Database, collectionId: string, key: string): Promise<Doc<Attribute>> {
    const collection = await db.getCollection(collectionId)
    if (collection.empty()) {
      throw new NotFoundError('Collection not found', { code: 'collection_not_found' })
    }

    const rawAttributes = (collection.get('attributes') ?? []) as Array<
      Record<string, unknown> | Doc<Attribute>
    >
    const found = rawAttributes.find((a) => {
      const k = a instanceof Doc ? a.get('key') : a.key
      const id = a instanceof Doc ? a.getId() : a.$id
      return k === key || id === key
    })

    if (!found) {
      throw new NotFoundError('Attribute not found', { code: 'attribute_not_found' })
    }

    return found instanceof Doc ? found : new Doc<Attribute>(found as unknown as Attribute)
  }

  /**
   * Create an attribute helper.
   */
  private async createAttribute(
    db: Database,
    collectionId: string,
    attributeDoc: Doc<Attribute>,
  ): Promise<Doc<Attribute>> {
    const collection = await db.getCollection(collectionId)
    if (collection.empty()) {
      throw new NotFoundError('Collection not found', { code: 'collection_not_found' })
    }

    const rawAttributes = (collection.get('attributes') ?? []) as Array<
      Record<string, unknown> | Doc<Attribute>
    >
    const exists = rawAttributes.some((a) => {
      const k = a instanceof Doc ? a.get('key') : a.key
      return k === attributeDoc.get('key')
    })

    if (exists) {
      throw new ConflictError('Attribute already exists', {
        code: 'attribute_already_exists',
      })
    }

    try {
      await db.createAttribute(collectionId, attributeDoc.toObject())
      return attributeDoc
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new ConflictError('Attribute already exists', {
          code: 'attribute_already_exists',
        })
      }
      throw error
    }
  }

  async createStringAttribute(
    db: Database,
    collectionId: string,
    input: CreateStringAttributeInput,
  ): Promise<Doc<Attribute>> {
    const filters: string[] = []
    if (input.encrypt) {
      filters.push('encrypt')
    }

    const attribute = new Doc<Attribute>({
      $id: input.key,
      key: input.key,
      type: AttributeType.String,
      size: input.size ?? 255,
      required: input.required ?? false,
      default: input.default ?? null,
      array: input.array ?? false,
      filters,
    })

    return this.createAttribute(db, collectionId, attribute)
  }

  async createEmailAttribute(
    db: Database,
    collectionId: string,
    input: CreateEmailAttributeInput,
  ): Promise<Doc<Attribute>> {
    const attribute = new Doc<Attribute>({
      $id: input.key,
      key: input.key,
      type: AttributeType.String,
      size: 254,
      required: input.required ?? false,
      default: input.default ?? null,
      array: input.array ?? false,
      format: AttributeFormat.EMAIL,
    })

    return this.createAttribute(db, collectionId, attribute)
  }

  async createEnumAttribute(
    db: Database,
    collectionId: string,
    input: CreateEnumAttributeInput,
  ): Promise<Doc<Attribute>> {
    const attribute = new Doc<Attribute>({
      $id: input.key,
      key: input.key,
      type: AttributeType.String,
      size: 255,
      required: input.required ?? false,
      default: input.default ?? null,
      array: input.array ?? false,
      format: AttributeFormat.ENUM,
      formatOptions: { elements: input.elements },
    })

    return this.createAttribute(db, collectionId, attribute)
  }

  async createIPAttribute(
    db: Database,
    collectionId: string,
    input: CreateIpAttributeInput,
  ): Promise<Doc<Attribute>> {
    const attribute = new Doc<Attribute>({
      $id: input.key,
      key: input.key,
      type: AttributeType.String,
      size: 39,
      required: input.required ?? false,
      default: input.default ?? null,
      array: input.array ?? false,
      format: AttributeFormat.IP,
    })

    return this.createAttribute(db, collectionId, attribute)
  }

  async createURLAttribute(
    db: Database,
    collectionId: string,
    input: CreateUrlAttributeInput,
  ): Promise<Doc<Attribute>> {
    const attribute = new Doc<Attribute>({
      $id: input.key,
      key: input.key,
      type: AttributeType.String,
      size: 2048,
      required: input.required ?? false,
      default: input.default ?? null,
      array: input.array ?? false,
      format: AttributeFormat.URL,
    })

    return this.createAttribute(db, collectionId, attribute)
  }

  async createIntegerAttribute(
    db: Database,
    collectionId: string,
    input: CreateIntegerAttributeInput,
  ): Promise<Doc<Attribute>> {
    const attribute = new Doc<Attribute>({
      $id: input.key,
      key: input.key,
      type: AttributeType.Integer,
      size: 8,
      required: input.required ?? false,
      default: input.default ?? null,
      array: input.array ?? false,
      format: AttributeFormat.INTEGER,
      formatOptions: { min: input.min, max: input.max },
    })

    return this.createAttribute(db, collectionId, attribute)
  }

  async createFloatAttribute(
    db: Database,
    collectionId: string,
    input: CreateFloatAttributeInput,
  ): Promise<Doc<Attribute>> {
    const attribute = new Doc<Attribute>({
      $id: input.key,
      key: input.key,
      type: AttributeType.Float,
      size: 8,
      required: input.required ?? false,
      default: input.default ?? null,
      array: input.array ?? false,
      format: AttributeFormat.FLOAT,
      formatOptions: { min: input.min, max: input.max },
    })

    return this.createAttribute(db, collectionId, attribute)
  }

  async createBooleanAttribute(
    db: Database,
    collectionId: string,
    input: CreateBooleanAttributeInput,
  ): Promise<Doc<Attribute>> {
    const attribute = new Doc<Attribute>({
      $id: input.key,
      key: input.key,
      type: AttributeType.Boolean,
      size: 0,
      required: input.required ?? false,
      default: input.default ?? null,
      array: input.array ?? false,
    })

    return this.createAttribute(db, collectionId, attribute)
  }

  async createDateAttribute(
    db: Database,
    collectionId: string,
    input: CreateDatetimeAttributeInput,
  ): Promise<Doc<Attribute>> {
    const attribute = new Doc<Attribute>({
      $id: input.key,
      key: input.key,
      type: AttributeType.Timestamptz,
      size: 0,
      required: input.required ?? false,
      default: input.default ?? null,
      array: input.array ?? false,
      format: AttributeFormat.DATETIME,
    })

    return this.createAttribute(db, collectionId, attribute)
  }

  async createRelationshipAttribute(
    db: Database,
    collectionId: string,
    input: CreateRelationAttributeInput,
  ): Promise<Doc<Attribute>> {
    const collection = await db.getCollection(collectionId)
    if (collection.empty()) {
      throw new NotFoundError('Collection not found', { code: 'collection_not_found' })
    }

    const relatedCollection = await db.getCollection(input.relatedCollection)
    if (relatedCollection.empty()) {
      throw new NotFoundError(`Related collection '${input.relatedCollection}' not found`, {
        code: 'collection_not_found',
      })
    }

    await db.createRelationship({
      collectionId,
      relatedCollectionId: input.relatedCollection,
      type: input.relationType,
      twoWay: input.twoWay ?? false,
      id: input.key,
      twoWayKey: input.twoWayKey,
      onDelete: input.onDelete,
    })

    return new Doc<Attribute>({
      $id: input.key,
      key: input.key,
      type: AttributeType.Relationship,
      options: {
        relatedCollection: input.relatedCollection,
        relationType: input.relationType,
        twoWay: input.twoWay,
        twoWayKey: input.twoWayKey,
        onDelete: input.onDelete ?? 'restrict',
        side: 'parent',
      },
    })
  }

  async updateAttribute(
    db: Database,
    collectionId: string,
    key: string,
    input: UpdateAttributeInput,
  ): Promise<Doc<Attribute>> {
    await this.getAttribute(db, collectionId, key)

    if (input.required !== undefined) {
      await db.updateAttributeRequired(collectionId, key, input.required)
    }

    return this.getAttribute(db, collectionId, key)
  }

  async deleteAttribute(db: Database, collectionId: string, key: string): Promise<void> {
    const attribute = await this.getAttribute(db, collectionId, key)

    if (attribute.get('type') === AttributeType.Relationship) {
      await db.deleteRelationship(collectionId, key)
    } else {
      await db.deleteAttribute(collectionId, key)
    }
  }
}
