import { Prop, Schema, SchemaFactory, Virtual } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";
import { BaseSchema } from "src/base/schemas/base.schema";

export type TokenDocument = HydratedDocument<Token>;

@Schema({
  timestamps: true,
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
export default class Token extends BaseSchema {

  @Prop({ type: String, required: true, index: true, unique: true })
  id: string;

  @Prop({ type: mongoose.Types.ObjectId, required: true, index: true })
  userInternalId: mongoose.Types.ObjectId;

  @Prop({ type: String })
  userId: string;

  @Prop({ type: Number, required: true })
  type: number;

  @Prop({ type: String, required: true })
  secret: string;

  @Prop({ type: Date, required: true })
  expire: Date;

  @Prop({ type: String, default: null })
  userAgent: string;

  @Prop({ type: String, default: null })
  ip: string;

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

export const TokenSchema = SchemaFactory.createForClass(Token);