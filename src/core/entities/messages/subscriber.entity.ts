import { Entity, Column, Index } from "typeorm";
import BaseEntity from "../base.entity";


@Entity({ name: 'subscribers', schema: 'messages' })
export class SubscriberEntity extends BaseEntity {
    @Index()
    @Column({ type: 'varchar', length: 128, nullable: false })
    targetId: string;

    @Index()
    @Column({ type: 'varchar', length: 128, nullable: false })
    targetInternalId: string;

    @Index()
    @Column({ type: 'varchar', length: 128, nullable: false })
    userId: string;

    @Index()
    @Column({ type: 'varchar', length: 128, nullable: false })
    userInternalId: string;

    @Index()
    @Column({ type: 'varchar', length: 128, nullable: false })
    topicId: string;

    @Index()
    @Column({ type: 'varchar', length: 128, nullable: false })
    topicInternalId: string;

    @Column({ type: 'varchar', length: 128, nullable: false })
    providerType: string;

    @Index()
    @Column({ type: 'varchar', length: 16384, nullable: true, default: '' })
    search: string;
}