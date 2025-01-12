import { Column, Entity, Index } from "typeorm";
import BaseEntity from "../base.entity";
import { Database } from "src/core/config/database";

@Entity({
  name: 'functions',
  schema: 'functions',
  orderBy: { name: 'ASC' }
})
@Index('_key__search', ['search'])
@Index('_key_name', ['name'], { unique: true })
@Index('_key_enabled', ['enabled'])
@Index('_key_installationId', ['installationId'])
@Index('_key_installationInternalId', ['installationInternalId'])
@Index('_key_providerRepositoryId', ['providerRepositoryId'])
@Index('_key_repositoryId', ['repositoryId'])
@Index('_key_repositoryInternalId', ['repositoryInternalId'])
@Index('_key_runtime', ['runtime'])
@Index('_key_idx_deployment', ['deployment'])
export class FunctionEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 128, nullable: true, array: true })
  execute: string[];

  @Column({ type: 'varchar', length: 2048, nullable: true })
  name: string;

  @Column({ type: 'boolean', nullable: false })
  enabled: boolean;

  @Column({ type: 'boolean', nullable: false })
  live: boolean;

  @Column({ type: 'varchar', length: Database.LENGTH_KEY, nullable: true })
  installationId: string;

  @Column({ type: 'varchar', length: Database.LENGTH_KEY, nullable: true })
  installationInternalId: string;

  @Column({ type: 'varchar', length: Database.LENGTH_KEY, nullable: true })
  providerRepositoryId: string;

  @Column({ type: 'varchar', length: Database.LENGTH_KEY, nullable: true })
  repositoryId: string;

  @Column({ type: 'varchar', length: Database.LENGTH_KEY, nullable: true })
  repositoryInternalId: string;

  @Column({ type: 'varchar', length: Database.LENGTH_KEY, nullable: true })
  providerBranch: string;

  @Column({ type: 'varchar', length: Database.LENGTH_KEY, nullable: true })
  providerRootDirectory: string;

  @Column({ type: 'boolean', nullable: true, default: false })
  providerSilentMode: boolean;

  @Column({ type: 'boolean', nullable: false })
  logging: boolean;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  runtime: string;

  @Column({ type: 'varchar', length: Database.LENGTH_KEY, nullable: true })
  deploymentInternalId: string;

  @Column({ type: 'varchar', length: Database.LENGTH_KEY, nullable: true })
  deployment: string;

  @Column({ type: 'varchar', length: 16384, nullable: true })
  vars: string;

  @Column({ type: 'varchar', length: 16384, nullable: true })
  varsProject: string;

  @Column({ type: 'varchar', length: 256, nullable: true, array: true })
  events: string[];

  @Column({ type: 'varchar', length: Database.LENGTH_KEY, nullable: true })
  scheduleInternalId: string;

  @Column({ type: 'varchar', length: Database.LENGTH_KEY, nullable: true })
  scheduleId: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  schedule: string;

  @Column({ type: 'int', nullable: true })
  timeout: number;

  @Column({ type: 'varchar', length: 8, nullable: true, default: 'v4' })
  version: string;

  @Column({ type: 'varchar', length: 16384, nullable: true })
  entrypoint: string;

  @Column({ type: 'varchar', length: 16384, nullable: true })
  commands: string;

  @Column({ type: 'varchar', length: 128, nullable: true, default: '' }) // APP_FUNCTION_SPECIFICATION_DEFAULT
  specification: string;

  @Column({ type: 'varchar', length: Database.LENGTH_KEY, nullable: true, array: true })
  scopes: string[];
}