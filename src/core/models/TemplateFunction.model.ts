import { Exclude, Expose } from 'class-transformer';
import BaseModel from 'src/core/models/base.model';

@Exclude()
export class TemplateFunctionModel extends BaseModel {
  /**
   * Function Template Icon.
   */
  @Expose() icon: string = ''; // Default to empty string

  /**
   * Function Template ID.
   */
  @Expose() id: string = ''; // Default to empty string

  /**
   * Function Template Name.
   */
  @Expose() name: string = ''; // Default to empty string

  /**
   * Function Template Tagline.
   */
  @Expose() tagline: string = ''; // Default to empty string

  /**
   * Execution permissions.
   */
  @Expose() permissions: string[] = []; // Default to empty array

  /**
   * Function trigger events.
   */
  @Expose() events: string[] = []; // Default to empty array

  /**
   * Function execution schedule in CRON format.
   */
  @Expose() cron: string = ''; // Default to empty string

  /**
   * Function execution timeout in seconds.
   */
  @Expose() timeout: number = 15; // Default to 15 seconds

  /**
   * Function use cases.
   */
  @Expose() useCases: string[] = []; // Default to empty array

  /**
   * List of runtimes that can be used with this template.
   */
  @Expose() runtimes: any[] = []; // Default to empty array

  /**
   * Function Template Instructions.
   */
  @Expose() instructions: string = ''; // Default to empty string

  /**
   * VCS (Version Control System) Provider.
   */
  @Expose() vcsProvider: string = ''; // Default to empty string

  /**
   * VCS (Version Control System) Repository ID.
   */
  @Expose() providerRepositoryId: string = ''; // Default to empty string

  /**
   * VCS (Version Control System) Owner.
   */
  @Expose() providerOwner: string = ''; // Default to empty string

  /**
   * VCS (Version Control System) branch version (tag).
   */
  @Expose() providerVersion: string = ''; // Default to empty string

  /**
   * Function variables.
   */
  @Expose() variables: any[] = []; // Default to empty array

  /**
   * Function scopes.
   */
  @Expose() scopes: string[] = []; // Default to empty array

  constructor(partial: Partial<TemplateFunctionModel>) {
    super(partial);
    Object.assign(this, partial);
  }
}
