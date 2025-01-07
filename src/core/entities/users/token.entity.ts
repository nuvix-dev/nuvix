import BaseEntity from "src/core/entities/base.entity";
import { Entity, Column, Index, ManyToOne, Relation } from "typeorm";
import { UserEntity } from "./user.entity";

@Entity({ name: 'tokens', schema: 'auth' })
export class TokenEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, user => user.tokens)
  @Index()
  user: Relation<UserEntity>;

  @Column({ type: 'varchar', nullable: true })
  userId: string;

  @Column({ type: 'int', nullable: false })
  type: number;

  @Column({ type: 'varchar', length: 512, nullable: true })
  secret: string;

  @Column({ type: 'timestamp', nullable: true })
  expire: Date;

  @Column({ type: 'varchar', length: 16384, nullable: true })
  userAgent: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string;
}

