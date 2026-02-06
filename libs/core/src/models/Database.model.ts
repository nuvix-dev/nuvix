import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class DatabaseModel extends BaseModel {
  /**
   * Database name.
   */
  @Expose() name = ''

  /**
   * If database is enabled. Can be 'enabled' or 'disabled'.
   * When disabled, the database is inaccessible to users,
   * but remains accessible to Server SDKs using API keys.
   */
  @Expose() enabled = true

  constructor(partial: Partial<DatabaseModel>) {
    super()
    Object.assign(this, partial)
  }
}
