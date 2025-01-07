import { Column, Entity, Index } from "typeorm";
import BaseEntity from "../base.entity";

@Entity({
    name: 'databases',
    schema: 'meta',
    orderBy: {
        name: 'ASC'
    }
})
export class DatabaseEntity extends BaseEntity {
    @Index()
    @Column({ type: 'varchar', length: 256, nullable: false })
    name: string;

    @Column({ type: 'boolean', nullable: true, default: true })
    enabled: boolean;

    @Index()
    @Column({ type: 'varchar', length: 16384, nullable: true })
    search: string;
}