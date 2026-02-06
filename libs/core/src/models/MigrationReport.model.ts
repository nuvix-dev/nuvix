import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class MigrationReportModel extends BaseModel {
  /**
   * Number of users to be migrated.
   */
  @Expose() users = 0 // Default to 0

  /**
   * Number of teams to be migrated.
   */
  @Expose() teams = 0 // Default to 0

  /**
   * Number of databases to be migrated.
   */
  @Expose() databases = 0 // Default to 0

  /**
   * Number of documents to be migrated.
   */
  @Expose() documents = 0 // Default to 0

  /**
   * Number of files to be migrated.
   */
  @Expose() files = 0 // Default to 0

  /**
   * Number of buckets to be migrated.
   */
  @Expose() buckets = 0 // Default to 0

  /**
   * Number of functions to be migrated.
   */
  @Expose() functions = 0 // Default to 0

  /**
   * Size of files to be migrated in MB.
   */
  @Expose() size = 0 // Default to 0

  /**
   * Version of the nuvix instance to be migrated.
   */
  @Expose() version = '' // Default to empty string

  constructor(partial: Partial<MigrationReportModel>) {
    super()
    Object.assign(this, partial)
  }
}
