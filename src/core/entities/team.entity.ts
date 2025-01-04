import { Column, Entity, Index, OneToMany, Relation } from "typeorm";
import { MembershipEntity } from "./membership.entity";
import BaseEntity from "./base.entity";

@Entity({ name: 'teams', schema: 'auth' })
export class TeamEntity extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 128, nullable: true })
  name: string;

  @Index()
  @Column({ type: 'int', nullable: true })
  total: number;

  @Index({ fulltext: true })
  @Column({ type: 'varchar', length: 16384, nullable: true })
  search: string;

  @Column({ type: 'json', nullable: true, default: () => "'{}'" })
  prefs: object;

  @OneToMany(() => MembershipEntity, member => member.team)
  members: Relation<MembershipEntity[]>;
}