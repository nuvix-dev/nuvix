import { Prop, Schema, SchemaFactory, Virtual } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";
import { BaseSchema } from "src/base/schemas/base.schema";

export type ChallengesDocument = HydratedDocument<Challenges>;

@Schema({
  timestamps: { createdAt: "$createdAt" },
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
export default class Challenges extends BaseSchema {

  @Prop({ type: String, required: true, index: true, unique: true })
  id: string;

  @Prop({ type: mongoose.Types.ObjectId, required: true, index: true })
  userInternalId: mongoose.Types.ObjectId;

  @Prop({ type: String })
  userId: string;

  @Prop({ type: String, default: null })
  type: string;

  @Prop({ type: String, default: null })
  token: string | null;

  @Prop({ type: String })
  code: string | null;

  @Prop({ type: Date, default: null })
  expire: Date | null;

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
      return this.deletedAt !== null && this.deletedAt !== undefined;
    },
    set(this: any, deleted: Boolean) {
      this.deletedAt = deleted ? new Date() : null;
    }
  })
  $deleted: Boolean;

  @Virtual({
    get(this: any) {
      return this.updatedAt;
    }
  })
  $updatedAt: Date;
}

export const ChallengesSchema = SchemaFactory.createForClass(Challenges);