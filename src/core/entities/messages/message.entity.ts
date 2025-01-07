import { Entity, Column, Index } from "typeorm";
import BaseEntity from "../base.entity";

@Entity({ name: 'messages', schema: 'messages' })
@Index('idx_provider_type', ['providerType'])
@Index('idx_status', ['status'])
@Index('idx_scheduled_at', ['scheduledAt'])
@Index('idx_schedule_internal_id', ['scheduleInternalId'])
@Index('idx_schedule_id', ['scheduleId'])
export class MessageEntity extends BaseEntity {
    @Index()
    @Column({ type: 'varchar', length: 128, nullable: false })
    providerType: string;

    @Column({ type: 'varchar', length: 128, nullable: false, default: 'processing' })
    status: string;

    @Column({ type: 'text', nullable: false })
    data: string;

    @Column({ type: 'varchar', length: 21845, nullable: true, array: true, default: [] })
    topics: string[];

    @Column({ type: 'varchar', length: 21845, nullable: true, array: true, default: [] })
    users: string[];

    @Column({ type: 'varchar', length: 21845, nullable: true, array: true, default: [] })
    targets: string[];

    @Column({ type: 'timestamp', nullable: true })
    scheduledAt: Date;

    @Column({ type: 'varchar', length: 128, nullable: true })
    scheduleInternalId: string;

    @Column({ type: 'varchar', length: 128, nullable: true })
    scheduleId: string;

    @Column({ type: 'timestamp', nullable: true })
    deliveredAt: Date;

    @Column({ type: 'text', nullable: true, array: true })
    deliveryErrors: string[];

    @Column({ type: 'int', default: 0, nullable: true })
    deliveredTotal: number;

    @Index()
    @Column({ type: 'varchar', length: 16384, nullable: true, default: '' })
    search: string;
}