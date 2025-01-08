import { Column, Entity, Index } from "typeorm";
import BaseEntity from "../base.entity";

@Entity({
  name: 'executions',
  schema: 'functions',
  orderBy: { scheduledAt: 'DESC' }
})
@Index('_key_function', ['functionId'])
@Index('_fulltext_search', ['search'])
@Index('_key_trigger', ['trigger'])
@Index('_key_status', ['status'])
@Index('_key_requestMethod', ['requestMethod'])
@Index('_key_requestPath', ['requestPath'])
@Index('_key_deployment', ['deploymentId'])
@Index('_key_responseStatusCode', ['responseStatusCode'])
@Index('_key_duration', ['duration'])
export class ExecutionsEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255, nullable: true })
  functionInternalId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  functionId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deploymentInternalId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deploymentId: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  trigger: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  status: string;

  @Column({ type: 'float', nullable: true })
  duration: number;

  @Column({ type: 'varchar', length: 1000000, nullable: true })
  errors: string;

  @Column({ type: 'varchar', length: 1000000, nullable: true })
  logs: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  requestMethod: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  requestPath: string;

  @Column({ type: 'varchar', length: 16384, nullable: true })
  requestHeaders: string;

  @Column({ type: 'int', nullable: true })
  responseStatusCode: number;

  @Column({ type: 'varchar', length: 16384, nullable: true })
  responseHeaders: string;

  @Column({ type: 'varchar', length: 16384, nullable: true })
  search: string;

  @Column({ type: 'timestamptz', nullable: true })
  scheduledAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  scheduleInternalId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  scheduleId: string;
}