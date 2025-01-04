import BaseEntity from "src/core/entities/base.entity";
import { Entity, Column, Index, ManyToOne, Relation } from "typeorm";
import { UserEntity } from "./user.entity";

@Entity({ name: 'authenticators', schema: 'auth' })
export class AuthenticatorEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, user => user.authenticators)
  user: Relation<UserEntity>;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  type: string;

  @Column({ type: 'boolean', default: false, nullable: true })
  verified: boolean;

  @Column({ type: 'text', nullable: true })
  data: string;
}