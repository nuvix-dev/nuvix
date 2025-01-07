import { Column, Entity, Index } from "typeorm";
import BaseEntity from "../base.entity";

@Entity({
    name: 'stats',
    schema: 'meta',
    orderBy: { time: 'DESC', metric: 'ASC', period: 'ASC' }
})
@Index('_key_time', ['time'])
@Index('_key_period_time', ['period', 'time'], { unique: true })
@Index('_key_metric_period_time', ['metric', 'period', 'time'])
export class StatsEntity extends BaseEntity {
    @Column({ type: 'varchar', length: 255, nullable: false })
    metric: string;

    @Column({ type: 'varchar', length: 255, nullable: false })
    region: string;

    @Column({ type: 'int', nullable: false })
    value: number;

    @Column({ type: 'timestamptz', nullable: true })
    time: Date;

    @Column({ type: 'varchar', length: 4, nullable: false })
    period: string;
}