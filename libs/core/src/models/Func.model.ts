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
  @Expose() name: string = ''

  /**
   * Function enabled.
   */
  @Expose() enabled: boolean = true

  /**
   * Is the function deployed with the latest configuration?
   */
  @Expose() live: boolean = true

  /**
   * Whether executions will be logged.
   */
  @Expose() logging: boolean = true

  /**
   * Function execution runtime.
   */
  @Expose() runtime: string = ''

  /**
   * Function's active deployment ID.
   */
  @Expose() deployment: string = ''

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
  @Expose() schedule: string = ''

  /**
   * Function execution timeout in seconds.
   */
  @Expose() timeout: number = 15

  /**
   * The entrypoint file used to execute the deployment.
   */
  @Expose() entrypoint: string = ''

  /**
   * The build command used to build the deployment.
   */
  @Expose() commands: string = ''

  /**
   * Version of Open Runtimes used for the function.
   */
  @Expose() version: string = 'v4'

  /**
   * Function VCS (Version Control System) installation id.
   */
  @Expose() installationId: string = ''

  /**
   * VCS (Version Control System) Repository ID.
   */
  @Expose() providerRepositoryId: string = ''

  /**
   * VCS (Version Control System) branch name.
   */
  @Expose() providerBranch: string = ''

  /**
   * Path to function in VCS (Version Control System) repository.
   */
  @Expose() providerRootDirectory: string = ''

  /**
   * Is VCS (Version Control System) connection in silent mode?
   */
  @Expose() providerSilentMode: boolean = false

  /**
   * Machine specification for builds and executions.
   */
  @Expose() specification: string = '' // Adjust default value based on your needs

  constructor(partial: Partial<FunctionModel>) {
    super()
    Object.assign(this, partial)
  }
}
