import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class FunctionModel extends BaseModel {
  /**
   * Execution permissions.
   */
  @Expose() execute: string[] = []

  /**
   * Function name.
   */
  @Expose() name = ''

  /**
   * Function enabled.
   */
  @Expose() enabled = true

  /**
   * Is the function deployed with the latest configuration?
   */
  @Expose() live = true

  /**
   * Whether executions will be logged.
   */
  @Expose() logging = true

  /**
   * Function execution runtime.
   */
  @Expose() runtime = ''

  /**
   * Function's active deployment ID.
   */
  @Expose() deployment = ''

  /**
   * Allowed permission scopes.
   */
  @Expose() scopes: string[] = []

  /**
   * Function variables.
   */
  @Expose() vars: any[] = [] // Adjust type based on your actual variable model

  /**
   * Function trigger events.
   */
  @Expose() events: string[] = []

  /**
   * Function execution schedule in CRON format.
   */
  @Expose() schedule = ''

  /**
   * Function execution timeout in seconds.
   */
  @Expose() timeout = 15

  /**
   * The entrypoint file used to execute the deployment.
   */
  @Expose() entrypoint = ''

  /**
   * The build command used to build the deployment.
   */
  @Expose() commands = ''

  /**
   * Version of Open Runtimes used for the function.
   */
  @Expose() version = 'v4'

  /**
   * Function VCS (Version Control System) installation id.
   */
  @Expose() installationId = ''

  /**
   * VCS (Version Control System) Repository ID.
   */
  @Expose() providerRepositoryId = ''

  /**
   * VCS (Version Control System) branch name.
   */
  @Expose() providerBranch = ''

  /**
   * Path to function in VCS (Version Control System) repository.
   */
  @Expose() providerRootDirectory = ''

  /**
   * Is VCS (Version Control System) connection in silent mode?
   */
  @Expose() providerSilentMode = false

  /**
   * Machine specification for builds and executions.
   */
  @Expose() specification = '' // Adjust default value based on your needs

  constructor(partial: Partial<FunctionModel>) {
    super()
    Object.assign(this, partial)
  }
}
