import { Prop, Schema, SchemaFactory, Virtual } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";
import { BaseSchema } from "src/base/schemas/base.schema";

export type InvoiceDocument = HydratedDocument<Invoice>;

@Schema({
  timestamps: true,
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
export class Invoice extends BaseSchema {
  @Prop({ type: String, required: true })
  userId: string;

  @Prop({ type: mongoose.Types.ObjectId, required: true })
  userInternalId: mongoose.Types.ObjectId;

  @Prop({ type: String, required: true })
  orgId: string;

  @Prop({ type: mongoose.Types.ObjectId, required: true })
  orgInternalId: mongoose.Types.ObjectId;

  @Prop({ type: String, required: true })
  aggregationId: string;

  @Prop({ type: String, required: true })
  plan: string;

  @Prop({ type: Object, required: true })
  usage: object;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: Number, default: 0 })
  tax: number;

  @Prop({ type: Number, default: 0 })
  taxAmount: number;

  @Prop({ type: Number, default: 0 })
  vat: number;

  @Prop({ type: Number, default: 0 })
  vatAmount: number;

  @Prop({ type: Number, required: true })
  grossAmount: number;

  @Prop({ type: Number, default: 0 })
  creditsUsed: number;

  @Prop({ type: String, required: true })
  currency: string;

  @Prop({ type: String })
  clientSecret: string;

  @Prop({ type: String, required: true })
  status: string;

  @Prop({ type: String })
  lastError: string;

  @Prop({ type: String, required: true })
  dueAt: string;

  @Prop({ type: String, required: true })
  from: string;

  @Prop({ type: String, required: true })
  to: string;

  @Virtual({
    get(this: any) {
      return this.orgId;
    }
  })
  teamId: string;

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

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);