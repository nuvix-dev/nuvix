import { Exclude, Expose } from 'class-transformer'

/**
 * Doc model.
 */
@Expose()
export class DocumentModel {
  /**
   *  ID.
   */
  @Expose() declare $id: string
  /**
   * User creation date in ISO 8601 format.
   */
  @Expose() declare $createdAt: Date
  /**
   * User update date in ISO 8601 format.
   */
  @Expose() declare $updatedAt: Date

  /**
   * Permissions.
   */
  @Expose() declare $permissions: string[]

  /**
   * Collection ID.
   */
  @Expose() declare $collection: string

  /**
   * Database ID.
   */
  @Expose() declare $schema: string

  /**
   * Runtime.
   */
  @Expose() declare runtime: string

  @Exclude() $internalId?: number
  @Exclude() $tenant?: number
}
