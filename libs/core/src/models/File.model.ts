import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class FileModel extends BaseModel {
  /**
   * Bucket ID.
   */
  @Expose() bucketId = ''

  /**
   * File permissions.
   */
  @Expose() permissions: string[] = []

  /**
   * File name.
   */
  @Expose() name = ''

  /**
   * File MD5 signature.
   */
  @Expose() signature = ''

  /**
   * File mime type.
   */
  @Expose() mimeType = ''

  /**
   * File original size in bytes.
   */
  @Expose() sizeOriginal = 0

  /**
   * Total number of chunks available.
   */
  @Expose() chunksTotal = 0

  /**
   * Total number of chunks uploaded.
   */
  @Expose() chunksUploaded = 0

  constructor(partial: Partial<FileModel>) {
    super()
    Object.assign(this, partial)
  }
}
