import { Column, CreateDateColumn, DeleteDateColumn, PrimaryColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import Permission from "../helper/permission.helper";


export default abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: string;

  @PrimaryColumn({ unique: true })
  $id: string;

  @CreateDateColumn({ type: 'timestamptz', precision: 0 })
  $createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', precision: 0 })
  $updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', precision: 0 })
  $deletedAt: Date;

  @Column({ type: 'varchar', length: 255, array: true, default: [] })
  $permissions: Permission[] | string[];

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