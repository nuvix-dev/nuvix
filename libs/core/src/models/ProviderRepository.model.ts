import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class ProviderRepositoryModel extends BaseModel {
  /**
   * VCS (Version Control System) repository name.
   */
  @Expose() name = '' // Default to empty string

  /**
   * VCS (Version Control System) organization name.
   */
  @Expose() organization = '' // Default to empty string

  /**
   * VCS (Version Control System) provider name.
   */
  @Expose() provider = '' // Default to empty string

  /**
   * Is VCS (Version Control System) repository private?
   */
  @Expose() private = false // Default to false

  /**
   * Auto-detected runtime suggestion. Empty if getting response of getRuntime().
   */
  @Expose() runtime = '' // Default to empty string

  /**
   * Last commit date in ISO 8601 format.
   */
  @Expose() pushedAt = '' // Default to empty string

  constructor(partial: Partial<ProviderRepositoryModel>) {
    super()
    Object.assign(this, partial)
  }
}
