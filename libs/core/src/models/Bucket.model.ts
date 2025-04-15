import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class BucketModel extends BaseModel {
  /**
   * Whether file-level security is enabled.
   */
  @Expose() fileSecurity: boolean = false;

  /**
   * Bucket name.
   */
  @Expose() name: string = '';

  /**
   * Bucket enabled.
   */
  @Expose() enabled: boolean = true;

  /**
   * Maximum file size supported.
   */
  @Expose() maximumFileSize: number = 0;

  /**
   * Allowed file extensions.
   */
  @Expose() allowedFileExtensions: string[] = [];

  /**
   * Compression algorithm chosen for compression.
   */
  @Expose() compression: string = '';

  /**
   * Bucket is encrypted.
   */
  @Expose() encryption: boolean = true;

  /**
   * Virus scanning is enabled.
   */
  @Expose() antivirus: boolean = true;

  constructor(partial: Partial<BucketModel>) {
    super();
    Object.assign(this, partial);
  }

  /**
   * Get Name
   *
   * @return string
   */
  getName(): string {
    return 'Bucket';
  }

  /**
   * Get Type
   *
   * @return string
   */
  getType(): string {
    return 'MODEL_BUCKET';
  }
}
