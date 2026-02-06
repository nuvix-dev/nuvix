import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class DeploymentModel extends BaseModel {
  /**
   * Type of deployment.
   */
  @Expose() type = ''

  /**
   * Resource ID.
   */
  @Expose() resourceId = ''

  /**
   * Resource type.
   */
  @Expose() resourceType = ''

  /**
   * The entrypoint file to use to execute the deployment code.
   */
  @Expose() entrypoint = ''

  /**
   * The code size in bytes.
   */
  @Expose() size = 0

  /**
   * The build output size in bytes.
   */
  @Expose() buildSize = 0

  /**
   * The current build ID.
   */
  @Expose() buildId = ''

  /**
   * Whether the deployment should be automatically activated.
   */
  @Expose() activate = false

  /**
   * The deployment status. Possible values are "processing", "building", "waiting", "ready", and "failed".
   */
  @Expose() status = ''

  /**
   * The build logs.
   */
  @Expose() buildLogs = ''

  /**
   * The current build time in seconds.
   */
  @Expose() buildTime = 0

  /**
   * The name of the VCS provider repository.
   */
  @Expose() providerRepositoryName = ''

  /**
   * The name of the VCS provider repository owner.
   */
  @Expose() providerRepositoryOwner = ''

  /**
   * The URL of the VCS provider repository.
   */
  @Expose() providerRepositoryUrl = ''

  /**
   * The branch name of the VCS provider repository.
   */
  @Expose() providerBranch = ''

  /**
   * The commit hash of the VCS commit.
   */
  @Expose() providerCommitHash = ''

  /**
   * The URL of the VCS commit author.
   */
  @Expose() providerCommitAuthorUrl = ''

  /**
   * The name of the VCS commit author.
   */
  @Expose() providerCommitAuthor = ''

  /**
   * The commit message.
   */
  @Expose() providerCommitMessage = ''

  /**
   * The URL of the VCS commit.
   */
  @Expose() providerCommitUrl = ''

  /**
   * The branch of the VCS repository.
   */
  @Expose() providerBranchUrl = ''

  constructor(partial: Partial<DeploymentModel>) {
    super()
    Object.assign(this, partial)
  }
}
