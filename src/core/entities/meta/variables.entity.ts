import { Column, Entity, Index } from "typeorm";
import BaseEntity from "../base.entity";
import { Database } from "src/core/config/database";

@Entity({
  name: 'variables',
  schema: 'meta',
  orderBy: { resourceType: 'ASC', resourceId: 'ASC', key: 'ASC' }
})
@Index('_key_resourceInternalId', ['resourceInternalId'])
@Index('_key_resourceType', ['resourceType'])
@Index('_key_resourceId_resourceType', ['resourceId', 'resourceType'])
@Index('_key_uniqueKey', ['resourceId', 'key', 'resourceType'], { unique: true })
@Index('_key_key', ['key'])
@Index('_fulltext_search', ['search'])
export class VariablesEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100, nullable: false })
  resourceType: string;

  @Column({ type: 'varchar', length: Database.LENGTH_KEY, nullable: true })
  resourceInternalId: string;

  @Column({ type: 'varchar', length: Database.LENGTH_KEY, nullable: true })
  resourceId: string;

  @Column({ type: 'varchar', length: Database.LENGTH_KEY, nullable: true })
  key: string;

  @Column({ type: 'varchar', length: 8192, nullable: false })
  value: string;

  @Column({ type: 'varchar', length: 16384, nullable: true })
  search: string;
}