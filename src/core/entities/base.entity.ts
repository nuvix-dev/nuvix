import { Column, CreateDateColumn, DeleteDateColumn, PrimaryColumn, UpdateDateColumn } from "typeorm";
import Permission from "../helper/permission.helper";


export default abstract class BaseEntity {
  @PrimaryColumn({ unique: true })
  $id: string;

  @CreateDateColumn({ type: 'timestamptz', precision: 0 })
  $createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', precision: 0 })
  $updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', precision: 0 })
  $deletedAt: Date;

  @Column({ type: 'text', nullable: true })
  $permissions: string;

  permissions() {
    return Permission.parse(this.$permissions)
  }
}