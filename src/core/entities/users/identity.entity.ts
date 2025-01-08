import { Column, Entity, Index, ManyToOne, Relation } from "typeorm";
import BaseEntity from "../base.entity";
import { UserEntity } from "./user.entity";

@Entity({
  name: 'identities',
  schema: 'auth',
  orderBy: { user: 'ASC', provider: 'ASC', providerUid: 'ASC' }
})
@Index('_key_userInternalId_provider_providerUid', ['user', 'provider', 'providerUid'], { unique: true })
@Index('_key_provider_providerUid', ['provider', 'providerUid'], { unique: true })
@Index('_key_userId', ['userId'])
@Index('_key_userInternalId', ['user'])
@Index('_key_provider', ['provider'])
@Index('_key_providerUid', ['providerUid'])
@Index('_key_providerEmail', ['providerEmail'])
@Index('_key_providerAccessTokenExpiry', ['providerAccessTokenExpiry'])
export class IdentityEntity extends BaseEntity {
  @ManyToOne(() => UserEntity, user => user.identities)
  user: Relation<UserEntity>;

  @Column({ type: 'varchar', nullable: false })
  userId: string;

  @Column({ type: 'varchar', length: 128, nullable: false })
  provider: string;

  @Column({ type: 'varchar', length: 2048, nullable: false })
  providerUid: string;

  @Column({ type: 'varchar', length: 320, nullable: false })
  providerEmail: string;

  @Column({ type: 'varchar', length: 16384, nullable: false })
  providerAccessToken: string;

  @Column({ type: 'timestamptz', nullable: true })
  providerAccessTokenExpiry: Date;

  @Column({ type: 'varchar', length: 16384, nullable: false })
  providerRefreshToken: string;

  @Column({ type: 'varchar', length: 16384, nullable: false })
  secrets: string;
}