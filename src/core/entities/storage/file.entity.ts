import { Column, Entity, Index, ManyToOne, Relation } from "typeorm";
import BaseEntity from "../base.entity";
import { BucketEntity } from "./bucket.entity";

@Entity({ name: 'files', schema: 'storage' })
export class FileEntity extends BaseEntity {
    @Index()
    @Column({ type: 'varchar'})
    bucketId: string;

    @ManyToOne(() => BucketEntity, bucket => bucket.files)
    bucket: Relation<BucketEntity>;

    @Index()
    @Column({ type: 'varchar', length: 2048 })
    name: string;

    @Column({ type: 'varchar', length: 2048 })
    path: string;

    @Index()
    @Column({ type: 'varchar', length: 2048 })
    signature: string;

    @Index()
    @Column({ type: 'varchar', length: 255 })
    mimeType: string;

    @Column({ type: 'varchar', length: 75000 })
    metadata: string;

    @Index()
    @Column({ type: 'int', unsigned: true })
    sizeOriginal: number;

    @Column({ type: 'int', unsigned: true })
    sizeActual: number;

    @Column({ type: 'varchar', length: 255 })
    algorithm: string;

    @Column({ type: 'varchar', length: 2048 })
    comment: string;

    @Column({ type: 'varchar', length: 64 })
    openSSLVersion: string;

    @Column({ type: 'varchar', length: 64 })
    openSSLCipher: string;

    @Column({ type: 'varchar', length: 2048 })
    openSSLTag: string;

    @Column({ type: 'varchar', length: 2048 })
    openSSLIV: string;

    @Index()
    @Column({ type: 'int', unsigned: true })
    chunksTotal: number;

    @Index()
    @Column({ type: 'int', unsigned: true })
    chunksUploaded: number;

    @Index()
    @Column({ type: 'varchar', length: 16384, nullable: true })
    search: string;
}