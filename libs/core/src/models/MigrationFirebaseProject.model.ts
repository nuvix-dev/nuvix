import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class MigrationFirebaseProjectModel extends BaseModel {
  /**
   * Project ID.
   */
  @Expose() projectId = ''

  /**
   * Project display name.
   */
  @Expose() displayName = ''

  constructor(partial: Partial<MigrationFirebaseProjectModel>) {
    super()
    Object.assign(this, partial)
  }
}
