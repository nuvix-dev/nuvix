import { Prop, Schema, SchemaFactory, Virtual } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";
import { BaseSchema } from "src/base/schemas/base.schema";

export type CampaignDocument = HydratedDocument<Campaign>;

@Schema({
  timestamps: true,
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
export class Campaign extends BaseSchema {
  @Prop({ type: String })
  template: string;

  @Prop({ type: String })
  title: string;

  @Prop({ type: String })
  description: string;

  @Prop({ type: String })
  plan?: string;

  @Prop({ type: String })
  cta?: string;

  @Prop({ type: String })
  claimed?: string;

  @Prop({ type: String })
  unclaimed?: string;

  @Prop({ type: Object })
  image?: object;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  reviews?: any[];

  @Prop({ type: Boolean })
  onlyNewOrgs?: boolean;

  @Prop({ type: Boolean })
  footer?: boolean;

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

export const CampaignSchema = SchemaFactory.createForClass(Campaign);