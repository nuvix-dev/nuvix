import { Exclude, Expose } from 'class-transformer';
import { BaseModel } from '@nuvix/core/models/base.model';

@Exclude()
export class DeploymentModel extends BaseModel {
  /**
   * Type of deployment.
   */
  @Expose() type: string = '';

  /**
   * Resource ID.
   */
  @Expose() resourceId: string = '';

  /**
   * Resource type.
   */
  @Expose() resourceType: string = '';

  /**
   * The entrypoint file to use to execute the deployment code.
   */
  @Expose() entrypoint: string = '';

  /**
   * The code size in bytes.
   */
  @Expose() size: number = 0;

  /**
   * The build output size in bytes.
   */
  @Expose() buildSize: number = 0;

  /**
   * The current build ID.
   */
  @Expose() buildId: string = '';

  /**
   * Whether the deployment should be automatically activated.
   */
  @Expose() activate: boolean = false;

  /**
   * The deployment status. Possible values are "processing", "building", "waiting", "ready", and "failed".
   */
  @Expose() status: string = '';

  /**
   * The build logs.
   */
  @Expose() buildLogs: string = '';

  /**
   * The current build time in seconds.
   */
  @Expose() buildTime: number = 0;

  /**
   * The name of the VCS provider repository.
   */
  @Expose() providerRepositoryName: string = '';

  /**
   * The name of the VCS provider repository owner.
   */
  @Expose() providerRepositoryOwner: string = '';

  /**
   * The URL of the VCS provider repository.
   */
  @Expose() providerRepositoryUrl: string = '';

  /**
   * The branch name of the VCS provider repository.
   */
  @Expose() providerBranch: string = '';

  /**
   * The commit hash of the VCS commit.
   */
  @Expose() providerCommitHash: string = '';

  /**
   * The URL of the VCS commit author.
   */
  @Expose() providerCommitAuthorUrl: string = '';

  /**
   * The name of the VCS commit author.
   */
  @Expose() providerCommitAuthor: string = '';

  /**
   * The commit message.
   */
  @Expose() providerCommitMessage: string = '';

  /**
   * The URL of the VCS commit.
   */
  @Expose() providerCommitUrl: string = '';

  /**
   * The branch of the VCS repository.
   */
  @Expose() providerBranchUrl: string = '';

  constructor(partial: Partial<DeploymentModel>) {
    super();
    Object.assign(this, partial);
  }
}
