import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class BucketModel extends BaseModel {
  /**
   * Whether file-level security is enabled.
   */
  @Expose() fileSecurity = false

  /**
   * Bucket name.
   */
  @Expose() name = ''

  /**
   * Bucket enabled.
   */
  @Expose() enabled = true

  /**
   * Maximum file size supported.
   */
  @Expose() maximumFileSize = 0

  /**
   * Allowed file extensions.
   */
  @Expose() allowedFileExtensions: string[] = []

  /**
   * Compression algorithm chosen for compression.
   */
  @Expose() compression = ''

  /**
   * Bucket is encrypted.
   */
  @Expose() encryption = true

  /**
   * Virus scanning is enabled.
   */
  @Expose() antivirus = true

  constructor(partial: Partial<BucketModel>) {
    super()
    Object.assign(this, partial)
  }
}
