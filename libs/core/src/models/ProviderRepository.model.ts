import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class ProviderRepositoryModel extends BaseModel {
  /**
   * VCS (Version Control System) repository ID.
   */
  @Expose() id: string = ''; // Default to empty string

  /**
   * VCS (Version Control System) repository name.
   */
  @Expose() name: string = ''; // Default to empty string

  /**
   * VCS (Version Control System) organization name.
   */
  @Expose() organization: string = ''; // Default to empty string

  /**
   * VCS (Version Control System) provider name.
   */
  @Expose() provider: string = ''; // Default to empty string

  /**
   * Is VCS (Version Control System) repository private?
   */
  @Expose() private: boolean = false; // Default to false

  /**
   * Auto-detected runtime suggestion. Empty if getting response of getRuntime().
   */
  @Expose() runtime: string = ''; // Default to empty string

  /**
   * Last commit date in ISO 8601 format.
   */
  @Expose() pushedAt: string = ''; // Default to empty string

  constructor(partial: Partial<ProviderRepositoryModel>) {
    super();
    Object.assign(this, partial);
  }
}
