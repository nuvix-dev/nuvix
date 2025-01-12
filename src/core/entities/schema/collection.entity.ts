import { Column, Entity, Index, OneToMany } from "typeorm";
import BaseEntity from "../base.entity";
import { AttributesEntity } from "./attribute.entity";
import { IndexesEntity } from "./indexes.entity";

@Entity({
    name: 'collections',
})
@Index('_fulltext_search', ['search'])
@Index('_key_name', ['name'])
@Index('_key_enabled', ['enabled'])
@Index('_key_documentSecurity', ['documentSecurity'])
export class CollectionsEntity extends BaseEntity {
    @Column({ type: 'varchar', length: 256, nullable: false })
    name: string;

    @Column({ type: 'boolean', nullable: false })
    enabled: boolean;

    @Column({ type: 'boolean', nullable: false })
    documentSecurity: boolean;

    // One-to-Many relationship with Attributes
    @OneToMany(() => AttributesEntity, (attribute) => attribute.collection, { cascade: true, onDelete: 'CASCADE' })
    attributes: AttributesEntity[];

    // One-to-Many relationship with Indexes
    @OneToMany(() => IndexesEntity, (index) => index.collection, { cascade: true, onDelete: 'CASCADE' })
    indexes: IndexesEntity[];
}