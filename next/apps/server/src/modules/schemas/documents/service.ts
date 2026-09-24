import {
  Doc,
  DuplicateException,
  ID,
  Permission,
  PermissionType,
  Query,
  Role,
  type Session,
  StructureException,
} from '@nuvix/db'
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../../shared/errors'

export interface CreateDocumentInput {
  documentId?: string
  data: Record<string, unknown>
  permissions?: string[]
}

export interface UpdateDocumentInput {
  data?: Record<string, unknown>
  permissions?: string[]
}

export class DocumentsService {
  /**
   * List documents from a collection.
   */
  async getDocuments(
    session: Session,
    collectionId: string,
    queries: Query[] = [],
  ): Promise<{ data: Doc<Record<string, unknown>>[]; total: number }> {
    const filterQueries = Query.groupByType(queries).filters
    const documents = await session.find(collectionId, queries)
    const total = await session.count(collectionId, filterQueries)

    return {
      data: documents,
      total,
    }
  }

  /**
   * Create a new document in a collection.
   */
  async createDocument(
    session: Session,
    collectionId: string,
    input: CreateDocumentInput,
    user?: { getId(): string; empty(): boolean },
  ): Promise<Doc<Record<string, unknown>>> {
    const docId =
      !input.documentId || input.documentId === 'unique()' ? ID.unique() : input.documentId

    const allowed = [PermissionType.Read, PermissionType.Update, PermissionType.Delete]

    let permissions = input.permissions ? Permission.aggregate(input.permissions, allowed) : null

    if (permissions === null && user && !user.empty()) {
      permissions = [
        Permission.read(Role.user(user.getId())).toString(),
        Permission.update(Role.user(user.getId())).toString(),
        Permission.delete(Role.user(user.getId())).toString(),
      ]
    }

    const payload: Record<string, unknown> = {
      ...input.data,
      $id: docId,
      $collection: collectionId,
      $permissions: permissions ?? [],
    }

    const document = new Doc(payload)

    try {
      return await session.createDocument(collectionId, document)
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new ConflictError('Document already exists', {
          code: 'document_already_exists',
        })
      }
      if (error instanceof StructureException) {
        throw new BadRequestError(error.message, {
          code: 'document_invalid_structure',
        })
      }
      throw error
    }
  }

  /**
   * Get a single document by ID.
   */
  async getDocument(
    session: Session,
    collectionId: string,
    documentId: string,
    queries: Query[] = [],
  ): Promise<Doc<Record<string, unknown>>> {
    const document = await session.getDocument(collectionId, documentId, queries)
    if (document.empty()) {
      throw new NotFoundError('Document not found', { code: 'document_not_found' })
    }
    return document
  }

  /**
   * Update an existing document.
   */
  async updateDocument(
    session: Session,
    collectionId: string,
    documentId: string,
    input: UpdateDocumentInput,
  ): Promise<Doc<Record<string, unknown>>> {
    if (!input.data && !input.permissions) {
      throw new BadRequestError('Payload or permissions required', {
        code: 'document_missing_payload',
      })
    }

    const existing = await session.getDocument(collectionId, documentId)
    if (existing.empty()) {
      throw new NotFoundError('Document not found', { code: 'document_not_found' })
    }

    const allowed = [PermissionType.Read, PermissionType.Update, PermissionType.Delete]

    const permissions = input.permissions
      ? Permission.aggregate(input.permissions, allowed)
      : existing.getPermissions()

    if (!permissions) {
      throw new UnauthorizedError('Unauthorized permissions', {
        code: 'user_unauthorized',
      })
    }

    const payload: Record<string, unknown> = {
      ...(input.data ?? existing.toObject()),
      $id: documentId,
      $permissions: permissions,
      $updatedAt: new Date(),
    }

    const newDocument = new Doc(payload)

    try {
      return await session.updateDocument(collectionId, documentId, newDocument)
    } catch (error) {
      if (error instanceof DuplicateException) {
        throw new ConflictError('Document already exists', {
          code: 'document_already_exists',
        })
      }
      if (error instanceof StructureException) {
        throw new BadRequestError(error.message, {
          code: 'document_invalid_structure',
        })
      }
      throw error
    }
  }

  /**
   * Delete a document.
   */
  async deleteDocument(session: Session, collectionId: string, documentId: string): Promise<void> {
    const existing = await session.getDocument(collectionId, documentId)
    if (existing.empty()) {
      throw new NotFoundError('Document not found', { code: 'document_not_found' })
    }

    await session.deleteDocument(collectionId, documentId)
  }
}
