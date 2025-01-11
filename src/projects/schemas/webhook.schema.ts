import { Prop, Schema, SchemaFactory, Virtual } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";
import { BaseSchema } from "src/base/schemas/base.schema";

export type WebhookDocument = HydratedDocument<Webhook>;

@Schema({
  timestamps: true,
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
export class Webhook extends BaseSchema {
  @Prop({ required: true, type: mongoose.Types.ObjectId, index: true, unique: true })
  projectInternalId: mongoose.Types.ObjectId;

  @Prop({ required: false, type: String })
  projectId: string;

  @Prop({ required: true, type: String })
  name: string;

  @Prop({ required: true, type: String })
  url: string;

  @Prop({ required: false, type: String })
  httpUser: string;

  @Prop({ required: false, type: String })
  httpPass: string;

  @Prop({ required: true, type: Boolean })
  security: boolean;

  @Prop({ required: true, type: [String] })
  events: string[];

  @Prop({ required: false, type: String })
  signatureKey: string;

  @Prop({ required: false, type: Boolean, default: true })
  enabled: boolean;

  @Prop({ required: false, type: String, default: '' })
  logs: string;

  @Prop({ required: false, type: Number, default: 0 })
  attempts: number;

  override permissions: string[];
  override deletedAt: Date;

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
}

export const WebhookSchema = SchemaFactory.createForClass(Webhook);