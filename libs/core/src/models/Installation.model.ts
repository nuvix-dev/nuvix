import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class InstallationModel extends BaseModel {
  /**
   * VCS (Version Control System) provider name.
   */
  @Expose() provider = ''

  /**
   * VCS (Version Control System) organization name.
   */
  @Expose() organization = ''

  /**
   * VCS (Version Control System) installation ID.
   */
  @Expose() providerInstallationId = ''

  constructor(partial: Partial<InstallationModel>) {
    super()
    Object.assign(this, partial)
  }
}
