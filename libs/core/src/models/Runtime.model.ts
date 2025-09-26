import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from '@nuvix/core/models/base.model';

@Exclude()
export class RuntimeModel extends BaseModel {
  /**
   * Parent runtime key.
   */
  @Expose() key: string = ''; // Default to empty string

  /**
   * Runtime Name.
   */
  @Expose() name: string = ''; // Default to empty string

  /**
   * Runtime version.
   */
  @Expose() version: string = ''; // Default to empty string

  /**
   * Base Docker image used to build the runtime.
   */
  @Expose() base: string = ''; // Default to empty string

  /**
   * Image name of Docker Hub.
   */
  @Expose() image: string = ''; // Default to empty string

  /**
   * Name of the logo image.
   */
  @Expose() logo: string = ''; // Default to empty string

  /**
   * List of supported architectures.
   */
  @Expose() supports: string[] = []; // Default to empty array

  constructor(partial: Partial<RuntimeModel>) {
    super();
    Object.assign(this, partial);
  }
}
