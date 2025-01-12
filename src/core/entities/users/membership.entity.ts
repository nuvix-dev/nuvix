import { Entity, ManyToOne, Relation } from "typeorm";
import BaseEntity from "../base.entity";
import { Column, Index } from "typeorm";
import { UserEntity } from "./user.entity";
import { TeamEntity } from "./team.entity";


@Entity({ name: 'memberships', schema: 'auth' })
@Index(['team', 'user'], { unique: true })
@Index('user_index', ['user'])
@Index('team_index', ['team'])
@Index('search_index', ['search'], { fulltext: true })
@Index('userId_index', ['userId'])
@Index('teamId_index', ['teamId'])
@Index('invited_index', ['invited'])
@Index('joined_index', ['joined'])
@Index('confirm_index', ['confirm'])
export class MembershipEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, user => user.memberships)
  user: Relation<UserEntity>;

  @Column({ type: 'varchar', nullable: true })
  userId: string;

  @ManyToOne(() => TeamEntity, team => team.members)
  team: Relation<TeamEntity>;

  @Column({ type: 'varchar', nullable: true })
  teamId: string;

  @Column({ type: 'varchar', length: 128, nullable: true, array: true })
  roles: string[];

  @Column({ type: 'timestamptz', nullable: true })
  invited: Date;

  @Column({ type: 'timestamptz', nullable: true })
  joined: Date;

  @Column({ type: 'boolean', nullable: true })
  confirm: boolean;

  @Column({ type: 'varchar', length: 256, nullable: true })
  secret: string;

}