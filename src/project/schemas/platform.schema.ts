import { Prop, Schema, SchemaFactory, Virtual } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";
import { BaseSchema } from "src/base/schemas/base.schema";

export type PlatformDocument = HydratedDocument<Platform>;

@Schema({
  timestamps: true,
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
export class Platform extends BaseSchema {
  @Prop({ required: true, type: mongoose.Types.ObjectId, index: true, unique: true })
  projectInternalId: mongoose.Types.ObjectId;

  @Prop({ required: false, type: String })
  projectId: string;

  @Prop({ required: false, type: String })
  type: string;

  @Prop({ required: true, type: String })
  name: string;

  @Prop({ required: false, type: String })
  key: string;

  @Prop({ required: false, type: String })
  store: string;

  @Prop({ required: false, type: String })
  hostname: string;

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

export const PlatformSchema = SchemaFactory.createForClass(Platform);