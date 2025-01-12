import { Column, CreateDateColumn, DeleteDateColumn, Index, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import Permission from "../helper/permission.helper";


export default abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: string;

  @Index('id_index', { synchronize: false })
  @PrimaryColumn({ unique: true, name: '_id' })
  $id: string;

  @Index('created_at_index', { synchronize: false })
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  $createdAt: Date;

  @Index('updated_at_index', { synchronize: false })
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  $updatedAt: Date;

  @Index('deleted_at_index', { synchronize: false })
  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  $deletedAt: Date;

  @Index('permissions_index', { synchronize: false })
  @Column({
    type: 'varchar',
    length: 255,
    array: true,
    default: [],
    name: 'permissions',
    transformer: {
      to: (value: Permission[] | string[]) => value.map(v => v.toString()),
      from: (value: string[]) => value
    }
  })
  $permissions: Permission[] | string[];

  @Index('search_index', { synchronize: false })
  @Column({ type: 'varchar', length: 16384, nullable: true })
  search: string;

  permissions() {
    return Permission.parse(this.$permissions.toString());
  }

  getInternalId() {
    return this.id;
  }

  getId() {
    return this.$id;
  }
}