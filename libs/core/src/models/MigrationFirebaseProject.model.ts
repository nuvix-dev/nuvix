import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class MigrationFirebaseProjectModel extends BaseModel {
  /**
   * Project ID.
   */
  @Expose() projectId: string = ''

  /**
   * Project display name.
   */
  @Expose() displayName: string = ''

  constructor(partial: Partial<MigrationFirebaseProjectModel>) {
    super()
    Object.assign(this, partial)
  }
}
