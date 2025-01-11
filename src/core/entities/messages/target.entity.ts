import BaseEntity from "../base.entity";
import { Entity, Column, ManyToOne, Relation, ManyToMany, Unique } from "typeorm";
import { UserEntity } from "../users/user.entity";
import { TopicEntity } from "./topic.entity";


@Entity({ name: 'targets', schema: 'messages' })
@Unique('identifire_type', ['identifier', 'providerType'])
export class TargetEntity extends BaseEntity {
  @Column({ type: 'varchar', nullable: false })
  userId: string;

  @ManyToOne(() => UserEntity, user => user.targets)
  user: Relation<UserEntity>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sessionId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  session: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  providerType: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerInternalId: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  identifier: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @Column({ type: 'boolean', default: false, nullable: true })
  expired: boolean;

  @ManyToMany(() => TopicEntity, topic => topic.targets)
  topics: TopicEntity[];
}