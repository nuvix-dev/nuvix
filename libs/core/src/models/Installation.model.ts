import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class InstallationModel extends BaseModel {
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
