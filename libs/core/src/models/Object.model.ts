import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class ObjectModel extends BaseModel {
  /**
   * Bucket ID.
   */
  @Expose() bucketId = ''

  /**
   * Object permissions.
   */
  @Expose() permissions: string[] = []

  /**
   * Object name.
   */
  @Expose() name = ''

  /**
   * Object version.
   */
  @Expose() version = ''

  /**
   * Object metadata.
   */
  @Expose() metadata: Record<string, string> = {}

  /**
   * Object path_tokens.
   */
  @Expose() tokens: string[] = []

  constructor(partial: Partial<ObjectModel>) {
    super()
    Object.assign(this, partial)
  }
}
