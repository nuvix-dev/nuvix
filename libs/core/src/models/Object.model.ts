import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class ObjectModel extends BaseModel {
  /**
   * Bucket ID.
   */
  @Expose() bucketId: string = ''

  /**
   * Object permissions.
   */
  @Expose() permissions: string[] = []

  /**
   * Object name.
   */
  @Expose() name: string = ''

  /**
   * Object version.
   */
  @Expose() version: string = ''

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
