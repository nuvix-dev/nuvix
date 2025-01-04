import { Column, Entity } from "typeorm";
import BaseEntity from "./base.entity";

@Entity({ name: 'buckets', schema: 'storage' })
export class BucketEntity extends BaseEntity {
  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'boolean', default: false })
  fileSecurity: boolean;

  @Column({ type: 'int', unsigned: true })
  maximumFileSize: number;

  @Column({ type: 'simple-array' })
  allowedFileExtensions: string[];

  @Column({ type: 'varchar', length: 10 })
  compression: string;

  @Column({ type: 'boolean', default: true })
  encryption: boolean;

  @Column({ type: 'boolean', default: true })
  antivirus: boolean;

  @Column({ type: 'varchar', length: 16384, nullable: true })
  search: string;
}