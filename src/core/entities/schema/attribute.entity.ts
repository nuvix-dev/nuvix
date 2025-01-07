import { Column, Entity, Index, ManyToOne, Relation } from "typeorm";
import BaseEntity from "../base.entity";
import { CollectionsEntity } from "./collection.entity";

@Entity({
    name: 'attributes',
})
@Index('_key_collection', ['collection'])
export class AttributesEntity extends BaseEntity {
    // Many-to-One relationship with Collections
    @ManyToOne(() => CollectionsEntity, (collection) => collection.attributes)
    collection: Relation<CollectionsEntity>;

    @Column({ type: 'varchar', length: 255, nullable: false })
    collectionId: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    key?: string;

    @Column({ type: 'varchar', length: 256, nullable: true })
    type?: string;

    @Column({ type: 'varchar', length: 16, nullable: true })
    status?: string;

    @Column({ type: 'varchar', length: 2048, nullable: true })
    error?: string;

    @Column({ type: 'int', nullable: true })
    size?: number;

    @Column({ type: 'boolean', nullable: true })
    required?: boolean;

    @Column({ type: 'varchar', length: 16384, nullable: true })
    default?: string;

    @Column({ type: 'boolean', nullable: true })
    signed?: boolean;

    @Column({ type: 'boolean', nullable: true })
    array?: boolean;

    @Column({ type: 'varchar', length: 64, nullable: true })
    format?: string;

    @Column({ type: 'json', length: 16384, nullable: true })
    formatOptions?: Record<string, any>;

    @Column({ type: 'varchar', length: 64, nullable: true, array: true })
    filters?: string[];

    @Column({ type: 'varchar', length: 16384, nullable: true })
    options?: string;
}