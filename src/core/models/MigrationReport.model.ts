import { Exclude, Expose } from 'class-transformer';
import BaseModel from 'src/core/models/base.model';

@Exclude()
export class MigrationReportModel extends BaseModel {
  /**
   * Number of users to be migrated.
   */
  @Expose() users: number = 0; // Default to 0

  /**
   * Number of teams to be migrated.
   */
  @Expose() teams: number = 0; // Default to 0

  /**
   * Number of databases to be migrated.
   */
  @Expose() databases: number = 0; // Default to 0

  /**
   * Number of documents to be migrated.
   */
  @Expose() documents: number = 0; // Default to 0

  /**
   * Number of files to be migrated.
   */
  @Expose() files: number = 0; // Default to 0

  /**
   * Number of buckets to be migrated.
   */
  @Expose() buckets: number = 0; // Default to 0

  /**
   * Number of functions to be migrated.
   */
  @Expose() functions: number = 0; // Default to 0

  /**
   * Size of files to be migrated in MB.
   */
  @Expose() size: number = 0; // Default to 0

  /**
   * Version of the nuvix instance to be migrated.
   */
  @Expose() version: string = ''; // Default to empty string

  constructor(partial: Partial<MigrationReportModel>) {
    super();
    Object.assign(this, partial);
  }
}
