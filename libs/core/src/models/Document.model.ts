import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

/**
 * Doc model.
 */
export class DocumentModel extends BaseModel {
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
