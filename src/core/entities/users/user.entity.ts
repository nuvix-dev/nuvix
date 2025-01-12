import BaseEntity from "src/core/entities/base.entity";
import { Entity, Column, Index, OneToMany, Relation } from "typeorm";
import { TokenEntity } from "./token.entity";
import { AuthenticatorEntity } from "./authenticator.entity";
import { ChallengeEntity } from "./challenge.entity";
import { SessionEntity } from "./session.entity";
import { MembershipEntity } from "./membership.entity";
import { TargetEntity } from "../messages/target.entity";
import { IdentityEntity } from "./identity.entity";

@Entity({ name: 'users', schema: 'auth' })
@Index("IDX_NAME", ["name"], { unique: false, })
@Index("IDX_EMAIL", ["email"], { unique: true })
@Index("IDX_PHONE", ["phone"], { unique: true })
@Index("IDX_STATUS", ["status"], { unique: false })
@Index("IDX_PASSWORD_UPDATE", ["passwordUpdate"], { unique: false })
@Index("IDX_REGISTRATION", ["registration"], { unique: false })
@Index("IDX_EMAIL_VERIFICATION", ["emailVerification"], { unique: false })
@Index("IDX_PHONE_VERIFICATION", ["phoneVerification"], { unique: false })
@Index("IDX_SEARCH", ["search"], { unique: false, fulltext: true })
@Index("IDX_ACCESSED_AT", ["accessedAt"], { unique: false })
export class UserEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 256, nullable: true })
  name: string;

  @Column({ type: 'varchar', length: 320, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  phone: string;

  @Column({ type: 'boolean', nullable: true })
  status: boolean;

  @Column({ type: 'varchar', length: 128, array: true, nullable: true })
  labels: string[];

  @Column({ type: 'varchar', length: 16384, array: true, nullable: true })
  passwordHistory: string[];

  @Column({ type: 'varchar', length: 16384, nullable: true })
  password: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  hash: string;

  @Column({ type: 'json', nullable: true })
  hashOptions: { [key: string]: string };

  @Column({ type: 'timestamp', nullable: true })
  passwordUpdate: Date;

  @Column({ type: 'json', nullable: true })
  prefs: any | { [key: string]: string };

  @Column({ type: 'timestamp', nullable: true })
  registration: Date;

  @Column({ type: 'boolean', nullable: true })
  emailVerification: boolean;

  @Column({ type: 'boolean', nullable: true })
  phoneVerification: boolean;

  @Column({ type: 'boolean', nullable: true })
  reset: boolean;

  @Column({ type: 'boolean', nullable: true })
  mfa: boolean;

  @Column({ type: 'varchar', length: 256, array: true, nullable: true })
  mfaRecoveryCodes: string[];

  @OneToMany(() => AuthenticatorEntity, auth => auth.user, { cascade: true, onDelete: 'CASCADE' })
  authenticators: Relation<AuthenticatorEntity[]>;

  @OneToMany(() => SessionEntity, session => session.user, { cascade: true, onDelete: 'CASCADE' })
  sessions: Relation<SessionEntity[]>;

  @OneToMany(() => TokenEntity, token => token.user, { cascade: true, onDelete: 'CASCADE' })
  tokens: Relation<TokenEntity[]>;

  @OneToMany(() => ChallengeEntity, challenge => challenge.user, { cascade: true, onDelete: 'CASCADE' })
  challenges: Relation<ChallengeEntity[]>;

  @OneToMany(() => MembershipEntity, membership => membership.user, { cascade: true, onDelete: 'CASCADE' })
  memberships: Relation<MembershipEntity[]>;

  @OneToMany(() => TargetEntity, target => target.user, { cascade: true, onDelete: 'CASCADE', eager: true })
  targets: Relation<TargetEntity[]>;

  @OneToMany(() => IdentityEntity, identity => identity.user, { cascade: true, onDelete: 'CASCADE' })
  identities: Relation<IdentityEntity[]>;

  @Column({ type: 'timestamp', nullable: true })
  accessedAt: Date;
}
