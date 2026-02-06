import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class BuildModel extends BaseModel {
  /**
   * The deployment that created this build.
   */
  @Expose() deploymentId = ''

  /**
   * The build status.
   * - Failed: The deployment build has failed. More details can usually be found in buildStderr.
   * - Ready: The deployment build was successful and the deployment is ready to be deployed.
   * - Processing: The deployment is currently waiting to have a build triggered.
   * - Building: The deployment is currently being built.
   */
  @Expose() status = ''

  /**
   * The stdout of the build.
   */
  @Expose() stdout = ''

  /**
   * The stderr of the build.
   */
  @Expose() stderr = ''

  /**
   * The deployment creation date in ISO 8601 format.
   */
  @Expose() startTime = ''

  /**
   * The time the build was finished in ISO 8601 format.
   */
  @Expose() endTime = ''

  /**
   * The build duration in seconds.
   */
  @Expose() duration = 0

  /**
   * The code size in bytes.
   */
  @Expose() size = 0

  constructor(partial: Partial<BuildModel>) {
    super()
    Object.assign(this, partial)
  }
}
