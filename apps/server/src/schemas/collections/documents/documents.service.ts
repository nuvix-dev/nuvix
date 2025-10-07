import { Injectable, Logger } from '@nestjs/common'
import {
  Authorization,
  AuthorizationException,
  Database,
  Doc,
  DuplicateException,
  ID,
  Permission,
  Query,
  QueryException,
  StructureException,
  PermissionType,
  Role,
  PermissionsValidator,
} from '@nuvix/db'
import { configuration, SchemaMeta } from '@nuvix/utils'
import { Auth } from '@nuvix/core/helper/auth.helper'
import { Exception } from '@nuvix/core/extend/exception'

// DTOs
import type { CreateDocumentDTO, UpdateDocumentDTO } from './DTO/document.dto'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { CollectionsDoc, UsersDoc } from '@nuvix/utils/types'

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name)

  constructor(private readonly event: EventEmitter2) {}

  private isEmpty(collection: CollectionsDoc) {
    return (
      collection.empty() ||
      (!collection.get('enabled', false) && !Auth.isTrustedActor)
    )
  }

  /**
   * Get Documents.
   */
  async getDocuments(
    db: Database,
    collectionId: string,
    queries: Query[] = [],
  ) {
    const collection = await Authorization.skip(() =>
      db.getDocument(SchemaMeta.collections, collectionId),
    )

    if (this.isEmpty(collection)) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND)
    } else {
      db.setCollectionEnabledValidate(false)
    }

    const filterQueries = Query.groupByType(queries).filters
    const documents = await db.find(collection.getId(), queries)

    const total = await db.count(
      collection.getId(),
      filterQueries,
      configuration.limits.limitCount,
    )

    return {
      total,
      data: documents,
    }
  }

  /**
   * Create a Doc.
   */
  async createDocument(
    db: Database,
    collectionId: string,
    { documentId, permissions, data }: CreateDocumentDTO,
    user: UsersDoc,
  ) {
    const collection = await Authorization.skip(() =>
      db.getDocument(SchemaMeta.collections, collectionId),
    )

    if (this.isEmpty(collection)) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND)
    } else {
      db.setCollectionEnabledValidate(false)
    }

    const allowedPermissions = [
      PermissionType.Read,
      PermissionType.Update,
      PermissionType.Delete,
    ]

    const aggregatedPermissions = Permission.aggregate(
      permissions,
      allowedPermissions,
    )

    if (!aggregatedPermissions) {
      throw new Exception(Exception.USER_UNAUTHORIZED)
    }

    data['$collection'] = collection.getId()
    data['$id'] = documentId === 'unique()' ? ID.unique() : documentId
    data['$permissions'] = aggregatedPermissions

    const document = new Doc(data)

    this.setPermissions(document, permissions, user, false)
    this.checkPermissions(collection, document, PermissionType.Update)

    try {
      const createdDocument = await db.createDocument(
        collection.getId(),
        document,
      )

      return createdDocument
    } catch (error) {
      if (error instanceof StructureException) {
        throw new Exception(Exception.DOCUMENT_INVALID_STRUCTURE, error.message)
      }
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.DOCUMENT_ALREADY_EXISTS)
      }
      throw error
    }
  }

  private checkPermissions(
    collection: CollectionsDoc,
    document: Doc,
    permission: PermissionType,
  ) {
    if (Auth.isTrustedActor) return
    const documentSecurity = collection.get('documentSecurity', false)
    const validator = new Authorization(permission)
    const valid = validator.$valid(collection.getPermissionsByType(permission))

    if ((permission === PermissionType.Update && !documentSecurity) || !valid) {
      throw new Exception(Exception.USER_UNAUTHORIZED)
    }

    if (permission === PermissionType.Update) {
      const validUpdate = validator.$valid(document.getUpdate())
      if (documentSecurity && !validUpdate) {
        throw new Exception(Exception.USER_UNAUTHORIZED)
      }
    }
  }

  private setPermissions(
    document: Doc,
    permissions: string[] | null,
    user: UsersDoc,
    isBulk: boolean,
  ): void {
    const allowedPermissions = [
      PermissionType.Read,
      PermissionType.Update,
      PermissionType.Delete,
    ]

    // If bulk, we need to validate permissions explicitly per document
    if (isBulk) {
      permissions = (document.getPermissions() as string[] | null) ?? null
      if (permissions && permissions.length > 0) {
        const validator = new PermissionsValidator()
        if (!validator.$valid(permissions)) {
          throw new Exception(
            Exception.GENERAL_BAD_REQUEST,
            validator.$description,
          )
        }
      }
    }

    permissions = Permission.aggregate(permissions, allowedPermissions)

    // Add permissions for current user if none were provided
    if (permissions === null && !Auth.isTrustedActor) {
      permissions = []
      if (user.getId()) {
        for (const perm of allowedPermissions) {
          permissions.push(
            new Permission(perm, Role.user(user.getId())).toString(),
          )
        }
      }
    }

    // Users can only manage their own roles, API keys and Admin users can manage any
    if (!Auth.isTrustedActor) {
      for (const type of Database.PERMISSIONS) {
        for (const p of permissions ?? []) {
          const parsed = Permission.parse(p)
          if (parsed.getPermission() !== type) continue

          const role = new Role(
            parsed.getRole(),
            parsed.getIdentifier(),
            parsed.getDimension(),
          ).toString()

          if (!Authorization.isRole(role)) {
            throw new Exception(
              Exception.USER_UNAUTHORIZED,
              `Permissions must be one of: (${Authorization.getRoles().join(', ')})`,
            )
          }
        }
      }
    }

    document.set('$permissions', permissions)
  }

  /**
   * Get a document.
   */
  async getDocument(
    db: Database,
    collectionId: string,
    documentId: string,
    queries: Query[] = [],
  ) {
    const collection = await Authorization.skip(() =>
      db.getDocument(SchemaMeta.collections, collectionId),
    )

    if (this.isEmpty(collection)) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND)
    } else {
      db.setCollectionEnabledValidate(false)
    }

    try {
      const document = await db.getDocument(
        collection.getId(),
        documentId,
        queries,
      )

      if (document.empty()) {
        throw new Exception(Exception.DOCUMENT_NOT_FOUND)
      }

      return document
    } catch (error) {
      if (error instanceof AuthorizationException) {
        throw new Exception(Exception.USER_UNAUTHORIZED)
      }
      if (error instanceof QueryException) {
        throw new Exception(Exception.GENERAL_QUERY_INVALID, error.message)
      }
      throw error
    }
  }

  /**
   * Get document logs.
   * TODO: Implement audit logs and return real data.
   */
  async getDocumentLogs(
    db: Database,
    collectionId: string,
    documentId: string,
    queries: Query[] = [],
  ) {
    // TODO: Implement this method
    return {
      total: 0, //await audit.countLogsByResource(resource),
      data: [],
    }
  }

  /**
   * Update a document.
   */
  async updateDocument(
    db: Database,
    collectionId: string,
    documentId: string,
    { data, permissions }: UpdateDocumentDTO,
  ) {
    if (!data && !permissions) {
      throw new Exception(Exception.DOCUMENT_MISSING_PAYLOAD)
    }

    const collection = await Authorization.skip(() =>
      db.getDocument(SchemaMeta.collections, collectionId),
    )

    if (this.isEmpty(collection)) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND)
    } else {
      db.setCollectionEnabledValidate(false)
    }

    const document = await Authorization.skip(() =>
      db.getDocument(collection.getId(), documentId),
    )

    if (document.empty()) {
      throw new Exception(Exception.DOCUMENT_NOT_FOUND)
    }

    const aggregatedPermissions = Permission.aggregate(
      permissions ?? document.getPermissions(),
      [PermissionType.Read, PermissionType.Update, PermissionType.Delete],
    )
    if (!aggregatedPermissions) {
      throw new Exception(Exception.USER_UNAUTHORIZED)
    }

    data!['$id'] = documentId
    data!['$permissions'] = aggregatedPermissions
    data!['$updatedAt'] = new Date()
    const newDocument = new Doc(data)

    try {
      const updatedDocument = await db.updateDocument(
        collection.getId(),
        document.getId(),
        newDocument,
      )

      return updatedDocument
    } catch (error) {
      if (error instanceof AuthorizationException) {
        throw new Exception(Exception.USER_UNAUTHORIZED)
      }
      if (error instanceof DuplicateException) {
        throw new Exception(Exception.DOCUMENT_ALREADY_EXISTS)
      }
      if (error instanceof StructureException) {
        throw new Exception(Exception.DOCUMENT_INVALID_STRUCTURE, error.message)
      }
      throw error
    }
  }

  /**
   * Delete a document.
   */
  async deleteDocument(
    db: Database,
    collectionId: string,
    documentId: string,
    timestamp?: Date,
  ) {
    const collection = await Authorization.skip(() =>
      db.getDocument(SchemaMeta.collections, collectionId),
    )

    if (this.isEmpty(collection)) {
      throw new Exception(Exception.COLLECTION_NOT_FOUND)
    } else {
      db.setCollectionEnabledValidate(false)
    }

    const document = await Authorization.skip(async () =>
      db.getDocument(collection.getId(), documentId),
    )

    if (document.empty()) {
      throw new Exception(Exception.DOCUMENT_NOT_FOUND)
    }

    await db.withRequestTimestamp(timestamp ?? null, async () =>
      db.deleteDocument(collection.getId(), documentId),
    )

    return
  }
}
