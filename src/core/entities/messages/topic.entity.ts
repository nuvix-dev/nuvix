import { Entity, Column, Index, ManyToMany } from "typeorm";
import BaseEntity from "../base.entity";
import { TargetEntity } from "./target.entity";

@Entity({ name: 'topics', schema: 'messages' })
export class TopicEntity extends BaseEntity {
    @Index()
    @Column({ type: 'varchar', length: 128, nullable: false })
    name: string;

    @Column({ type: 'varchar', length: 128, nullable: true, array: true })
    subscribe: string[];

    @Column({ type: 'int', default: 0, nullable: true })
    emailTotal: number;

    @Column({ type: 'int', default: 0, nullable: true })
    smsTotal: number;

    @Column({ type: 'int', default: 0, nullable: true })
    pushTotal: number;

    @ManyToMany(() => TargetEntity, target => target.topics, { eager: true })
    targets: TargetEntity[];

}
