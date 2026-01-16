import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class BuildModel extends BaseModel {
  /**
   * The deployment that created this build.
   */
  @Expose() deploymentId: string = ''

  /**
   * The build status.
   * - Failed: The deployment build has failed. More details can usually be found in buildStderr.
   * - Ready: The deployment build was successful and the deployment is ready to be deployed.
   * - Processing: The deployment is currently waiting to have a build triggered.
   * - Building: The deployment is currently being built.
   */
  @Expose() status: string = ''

  /**
   * The stdout of the build.
   */
  @Expose() stdout: string = ''

  /**
   * The stderr of the build.
   */
  @Expose() stderr: string = ''

  /**
   * The deployment creation date in ISO 8601 format.
   */
  @Expose() startTime: string = ''

  /**
   * The time the build was finished in ISO 8601 format.
   */
  @Expose() endTime: string = ''

  /**
   * The build duration in seconds.
   */
  @Expose() duration: number = 0

  /**
   * The code size in bytes.
   */
  @Expose() size: number = 0

  constructor(partial: Partial<BuildModel>) {
    super()
    Object.assign(this, partial)
  }
}
