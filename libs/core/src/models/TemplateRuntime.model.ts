import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class TemplateRuntimeModel extends BaseModel {
  /**
   * Runtime Name.
   */
  @Expose() name = '' // Default to empty string

  /**
   * The build command used to build the deployment.
   */
  @Expose() commands = '' // Default to empty string

  /**
   * The entrypoint file used to execute the deployment.
   */
  @Expose() entrypoint = '' // Default to empty string

  /**
   * Path to function in VCS (Version Control System) repository.
   */
  @Expose() providerRootDirectory = '' // Default to empty string

  constructor(partial: Partial<TemplateRuntimeModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}
