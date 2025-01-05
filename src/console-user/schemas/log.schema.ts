import { Prop, Schema, SchemaFactory, Virtual } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";
import { BaseSchema } from "src/base/schemas/base.schema";

export type LogDocument = HydratedDocument<Log>;

@Schema({
  timestamps: { createdAt: "$createdAt" },
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
export class Log extends BaseSchema {
  @Prop({ type: String, required: true })
  event: string;

  @Prop({ type: mongoose.Types.ObjectId, required: true })
  userInternalId: mongoose.Types.ObjectId;

  @Prop({ type: String })
  userId: string;

  @Prop({ type: String, required: true })
  userEmail: string;

  @Prop({ type: String })
  userName: string;

  @Prop({ type: String })
  mode: string;

  @Prop({ type: String })
  ip: string;

  @Prop({ type: String, required: true })
  time: string;

  @Prop({
    type: {
      code: String,
      name: String,
      version: String
    },
  })
  os: {
    code: string;
    name: string;
    version: string;
  };

  @Prop({
    type: {
      type: String,
      code: String,
      name: String,
      version: String,
      engine: String,
      engineVersion: String
    },
  })
  client: {
    type: string;
    code: string;
    name: string;
    version: string;
    engine: string;
    engineVersion: string;
  };

  @Prop({
    type: {
      name: String,
      brand: String,
      model: String
    },
  })
  device: {
    name: string;
    brand: string;
    model: string;
  };

  @Prop({
    type: {
      code: String,
      name: String
    },
  })
  country: {
    code: string;
    name: string;
  };

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
      return this.id;
    },
    set(this: any, id: string) {
      this.id = id;
    }
  })
  $id: string;

  @Virtual({
    get(this: any) {
      return this.updatedAt;
    }
  })
  $updatedAt: Date;
}


export const LogSchema = SchemaFactory.createForClass(Log);