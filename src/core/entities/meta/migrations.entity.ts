import { Column, Entity, Index } from "typeorm";
import BaseEntity from "../base.entity";

@Entity({
  name: 'migrations',
  schema: 'meta',
  orderBy: { status: 'ASC', stage: 'ASC' }
})
@Index('_key_status', ['status'])
@Index('_key_stage', ['stage'])
@Index('_key_source', ['source'])
@Index('_fulltext__search', ['search'])
export class MigrationsEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255, nullable: false })
  status: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  stage: string;

  @Column({ type: 'varchar', length: 8192, nullable: false })
  source: string;

  @Column({ type: 'varchar', length: 65536, nullable: true, transformer: { to: value => JSON.stringify(value), from: value => JSON.parse(value) } })
  credentials: string;

  @Column({ type: 'varchar', length: 255, nullable: false, array: true })
  resources: string[];

  @Column({ type: 'varchar', length: 3000, nullable: false, transformer: { to: value => JSON.stringify(value), from: value => JSON.parse(value) } })
  statusCounters: string;

  @Column({ type: 'varchar', length: 131070, nullable: false, transformer: { to: value => JSON.stringify(value), from: value => JSON.parse(value) } })
  resourceData: string;

  @Column({ type: 'varchar', length: 65535, nullable: false, array: true })
  errors: string[];

  @Column({ type: 'varchar', length: 16384, nullable: true })
  search: string;
}