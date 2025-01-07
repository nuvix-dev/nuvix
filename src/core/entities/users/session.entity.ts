import { Column, Entity, ManyToOne, Relation } from "typeorm";
import BaseEntity from "../base.entity";
import { UserEntity } from "./user.entity";


@Entity({ name: 'sessions', schema: 'auth' })
export class SessionEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, user => user.sessions)
  user: Relation<UserEntity>;

  @Column({ type: 'varchar', nullable: true })
  userId: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  provider: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  providerUid: string;

  @Column({ type: 'varchar', length: 16384, nullable: true })
  providerAccessToken: string;

  @Column({ type: 'timestamptz', nullable: true })
  providerAccessTokenExpiry: Date;

  @Column({ type: 'varchar', length: 16384, nullable: true })
  providerRefreshToken: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  secret: string;

  @Column({ type: 'varchar', length: 16384, nullable: true })
  userAgent: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  countryCode: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  osCode: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  osName: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  osVersion: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  clientType: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  clientCode: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  clientName: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  clientVersion: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  clientEngine: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  clientEngineVersion: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  deviceName: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  deviceBrand: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  deviceModel: string;

  @Column({ type: 'simple-array', nullable: true })
  factors: string[];

  @Column({ type: 'timestamptz', nullable: false })
  expire: Date;

  @Column({ type: 'timestamptz', nullable: true })
  mfaUpdatedAt: Date;
}