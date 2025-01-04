import BaseEntity from "./base.entity";
import { Entity, Column, Index, ManyToOne, Relation } from "typeorm";
import { UserEntity } from "./user.entity";


@Entity({ name: 'challenges', schema: 'auth' })
@Index("idx_user_id", ["user"])
export class ChallengeEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, user => user.challenges)
  user: Relation<UserEntity>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  type: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  token: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  code: string;

  @Column({ type: 'timestamptz', nullable: true })
  expire: Date;
}



