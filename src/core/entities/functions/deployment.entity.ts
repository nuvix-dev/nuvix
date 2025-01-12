import { Column, Entity, Index } from "typeorm";
import BaseEntity from "../base.entity";

@Entity({
  name: 'deployments',
  schema: 'functions',
  orderBy: { resourceId: 'ASC' }
})
@Index('_key_resource', ['resourceId'])
@Index('_key_resource_type', ['resourceType'])
@Index('_key_search', ['search'])
@Index('_key_size', ['size'])
@Index('_key_buildId', ['buildId'])
@Index('_key_activate', ['activate'])
export class DeploymentEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255, nullable: true })
  resourceInternalId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resourceId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resourceType: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  buildInternalId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  buildId: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  entrypoint: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  commands: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  path: string;

  @Column({ type: 'varchar', length: 2048, nullable: false })
  type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  installationId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  installationInternalId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerRepositoryId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  repositoryId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  repositoryInternalId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerRepositoryName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerRepositoryOwner: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerRepositoryUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerCommitHash: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerCommitAuthorUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerCommitAuthor: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerCommitMessage: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerCommitUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerBranch: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerBranchUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerRootDirectory: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  providerCommentId: string;

  @Column({ type: 'int', nullable: true })
  size: number;

  @Column({ type: 'varchar', length: 16384, nullable: true })
  metadata: string;

  @Column({ type: 'int', nullable: true })
  chunksTotal: number;

  @Column({ type: 'int', nullable: true })
  chunksUploaded: number;

  @Column({ type: 'boolean', nullable: true, default: false })
  activate: boolean;
}