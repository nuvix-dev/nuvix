import { Exclude, Expose } from 'class-transformer';
import BaseModel from 'src/core/models/base.model';

@Exclude()
export class InstallationModel extends BaseModel {
  /**
   * Function ID.
   */
  @Expose() id: string = '';

  /**
   * Function creation date in ISO 8601 format.
   */
  @Expose() createdAt: string; // No default value

  /**
   * Function update date in ISO 8601 format.
   */
  @Expose() updatedAt: string; // No default value

  /**
   * VCS (Version Control System) provider name.
   */
  @Expose() provider: string = '';

  /**
   * VCS (Version Control System) organization name.
   */
  @Expose() organization: string = '';

  /**
   * VCS (Version Control System) installation ID.
   */
  @Expose() providerInstallationId: string = '';

  constructor(partial: Partial<InstallationModel>) {
    super();
    Object.assign(this, partial);
  }
}
