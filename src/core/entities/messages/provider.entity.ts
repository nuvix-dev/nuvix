import { Entity, Column, Index } from "typeorm";
import BaseEntity from "../base.entity";

@Entity({ name: 'providers', schema: 'messages' })
export class ProviderEntity extends BaseEntity {
    @Index()
    @Column({ type: 'varchar', length: 128, nullable: false })
    name: string;

    @Index()
    @Column({ type: 'varchar', length: 128, nullable: false })
    provider: string;

    @Index()
    @Column({ type: 'varchar', length: 128, nullable: false })
    type: string;

    @Column({ type: 'boolean', default: true, nullable: false })
    enabled: boolean;

    @Column({ type: 'varchar', length: 16384, nullable: false })
    credentials: string;

    @Column({ type: 'varchar', length: 16384, nullable: true, default: '' })
    options: string;

}