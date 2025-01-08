import { Column, Entity, Index } from "typeorm";
import BaseEntity from "../base.entity";

@Entity({
  name: 'builds',
  schema: 'functions',
  orderBy: { startTime: 'DESC' }
})
@Index('_key_deployment', ['deploymentId'])
export class BuildsEntity extends BaseEntity {
  @Column({ type: 'timestamptz', nullable: true })
  startTime: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endTime: Date;

  @Column({ type: 'int', nullable: true })
  duration: number;

  @Column({ type: 'int', nullable: true })
  size: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deploymentInternalId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deploymentId: string;

  @Column({ type: 'varchar', length: 2048, nullable: false })
  runtime: string;

  @Column({ type: 'varchar', length: 256, nullable: false, default: 'processing' })
  status: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  path: string;

  @Column({ type: 'varchar', length: 1000000, nullable: true })
  logs: string;

  @Column({ type: 'varchar', length: 2048, nullable: false, default: 'local' })
  sourceType: string;

  @Column({ type: 'varchar', length: 2048, nullable: false })
  source: string;
}