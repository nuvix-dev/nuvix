import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class TemplateFunctionModel extends BaseModel {
  /**
   * Function Template Icon.
   */
  @Expose() icon = '' // Default to empty string

  /**
   * Function Template Name.
   */
  @Expose() name = '' // Default to empty string

  /**
   * Function Template Tagline.
   */
  @Expose() tagline = '' // Default to empty string

  /**
   * Execution permissions.
   */
  @Expose() permissions: string[] = [] // Default to empty array

  /**
   * Function trigger events.
   */
  @Expose() events: string[] = [] // Default to empty array

  /**
   * Function execution schedule in CRON format.
   */
  @Expose() cron = '' // Default to empty string

  /**
   * Function execution timeout in seconds.
   */
  @Expose() timeout = 15 // Default to 15 seconds

  /**
   * Function use cases.
   */
  @Expose() useCases: string[] = [] // Default to empty array

  /**
   * List of runtimes that can be used with this template.
   */
  @Expose() runtimes: any[] = [] // Default to empty array

  /**
   * Function Template Instructions.
   */
  @Expose() instructions = '' // Default to empty string

  /**
   * VCS (Version Control System) Provider.
   */
  @Expose() vcsProvider = '' // Default to empty string

  /**
   * VCS (Version Control System) Repository ID.
   */
  @Expose() providerRepositoryId = '' // Default to empty string

  /**
   * VCS (Version Control System) Owner.
   */
  @Expose() providerOwner = '' // Default to empty string

  /**
   * VCS (Version Control System) branch version (tag).
   */
  @Expose() providerVersion = '' // Default to empty string

  /**
   * Function variables.
   */
  @Expose() variables: any[] = [] // Default to empty array

  /**
   * Function scopes.
   */
  @Expose() scopes: string[] = [] // Default to empty array

  constructor(partial: Partial<TemplateFunctionModel>) {
    super(partial)
    Object.assign(this, partial)
  }
}
