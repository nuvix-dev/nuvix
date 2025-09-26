import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from '@nuvix/core/models/base.model';

@Exclude()
export class MigrationModel extends BaseModel {
  /**
   * Migration status (pending, processing, failed, completed).
   */
  @Expose() status: string = '';

  /**
   * Migration stage (init, processing, source-check, destination-check, migrating, finished).
   */
  @Expose() stage: string = '';

  /**
   * A string containing the type of source of the migration.
   */
  @Expose() source: string = '';

  /**
   * Resources to migrate.
   */
  @Expose() resources: string[] = []; // Default to empty array

  /**
   * A group of counters that represent the total progress of the migration.
   */
  @Expose() statusCounters: Record<string, any> = {}; // Default to empty object

  /**
   * An array of objects containing the report data of the resources that were migrated.
   */
  @Expose() resourceData: Record<string, any>[] = []; // Default to empty array

  /**
   * All errors that occurred during the migration process.
   */
  @Expose() errors: string[] = []; // Default to empty array

  constructor(partial: Partial<MigrationModel>) {
    super();
    Object.assign(this, partial);
  }
}
