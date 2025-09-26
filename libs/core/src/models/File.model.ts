import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from '@nuvix/core/models/base.model';

@Exclude()
export class FileModel extends BaseModel {
  /**
   * Bucket ID.
   */
  @Expose() bucketId: string = '';

  /**
   * File permissions.
   */
  @Expose() permissions: string[] = [];

  /**
   * File name.
   */
  @Expose() name: string = '';

  /**
   * File MD5 signature.
   */
  @Expose() signature: string = '';

  /**
   * File mime type.
   */
  @Expose() mimeType: string = '';

  /**
   * File original size in bytes.
   */
  @Expose() sizeOriginal: number = 0;

  /**
   * Total number of chunks available.
   */
  @Expose() chunksTotal: number = 0;

  /**
   * Total number of chunks uploaded.
   */
  @Expose() chunksUploaded: number = 0;

  constructor(partial: Partial<FileModel>) {
    super();
    Object.assign(this, partial);
  }
}
