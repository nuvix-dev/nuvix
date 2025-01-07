import { Prop, Schema, SchemaFactory, Virtual } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";
import { BaseSchema } from "src/base/schemas/base.schema";


export type MembershipDocument = HydratedDocument<Membership>;


/**
 * Represents a Membership in the Organization.
 */
@Schema({
  timestamps: true,
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
export class Membership extends BaseSchema {

  @Prop({ type: String, required: true, index: true, unique: true })
  id: string;

  @Prop({ type: mongoose.Types.ObjectId, required: true, index: true })
  userInternalId: string;

  @Prop({ type: String, index: true })
  userId: string;

  @Prop({ type: String, default: "" })
  userName: string;

  @Prop({ type: String, required: true })
  userEmail: string;

  @Prop({ type: String, index: true })
  orgId: string;

  @Prop({ type: mongoose.Types.ObjectId, required: true, index: true })
  orgInternalId: string;

  @Prop({ type: String, default: "" })
  orgName: string;

  @Prop({ type: Date, required: true, default: new Date(), index: true })
  invited: Date;

  @Prop({ type: Date, index: true })
  joined: Date | null;

  @Prop({ type: Boolean, required: true, default: false, index: true })
  confirm: boolean;

  @Prop({ type: String, default: null })
  secret: string;

  @Prop({ type: Boolean, required: true, default: false })
  mfa: boolean;

  @Prop({ type: [String], required: true, default: [] })
  roles: string[];

  @Virtual({
    get(this: any) {
      return this.orgId
    },
    set(this, orgId: string) {
      this.orgId = orgId
    }
  })
  teamId: string;

  @Virtual({
    get(this: any) {
      return this.orgName
    },
    set(this, orgName: string) {
      this.orgName = orgName
    }
  })
  teamName: string

  @Virtual({
    get(this: any) {
      return this.id;
    },
    set(this: any, id: string) {
      this.id = id;
    }
  })
  $id: string;

  @Virtual({
    get(this: any) {
      return this.createdAt;
    },
    set(this: any, createdAt: Date) {
      this.createdAt = createdAt;
    }
  })
  $createdAt: Date;

  @Virtual({
    get(this: any) {
      return this.updatedAt;
    },
    set(this: any, updatedAt: Date) {
      this.updatedAt = updatedAt;
    }
  })
  $updatedAt: Date;

  @Virtual({
    get(this: any) {
      return this.deletedAt !== null && this.deletedAt !== undefined;
    },
    set(this: any, deleted: Boolean) {
      this.deletedAt = deleted ? new Date() : null;
    }
  })
  $deleted: Boolean;

  @Virtual({
    get(this: any) {
      return this.permissions;
    },
    set(this: any, permissions: string[]) {
      this.permissions = permissions;
    }
  })
  $permissions: string[];
}

export const MembershipSchema = SchemaFactory.createForClass(Membership)