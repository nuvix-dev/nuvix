import { Column, Entity, Index, ManyToOne, Relation } from "typeorm";
import BaseEntity from "../base.entity";
import { CollectionsEntity } from "./collection.entity";

@Entity({
    name: 'indexes',
})
@Index('_key_collection', ['collection'])
export class IndexesEntity extends BaseEntity {
    // Many-to-One relationship with Collections
    @ManyToOne(() => CollectionsEntity, (collection) => collection.indexes)
    collection: Relation<CollectionsEntity>;

    @Column({ type: 'varchar', length: 255, nullable: false })
    collectionId: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    key?: string;

    @Column({ type: 'varchar', length: 16, nullable: true })
    type?: string;

    @Column({ type: 'varchar', length: 16, nullable: true })
    status?: string;

    @Column({ type: 'varchar', length: 2048, nullable: true })
    error?: string;

    @Column({ type: 'varchar', length: 255, nullable: true, array: true })
    attributes?: string[];

    @Column({ type: 'int', nullable: true, array: true })
    lengths?: number[];

    @Column({ type: 'varchar', length: 4, nullable: true, array: true })
    orders?: string[];
}