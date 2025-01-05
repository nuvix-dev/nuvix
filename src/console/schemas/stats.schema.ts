import { Prop, Schema, SchemaFactory, Virtual } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { BaseSchema } from "src/base/schemas/base.schema";

export type StatsDocument = HydratedDocument<Stats>;


@Schema({
  timestamps: { createdAt: "$createdAt" },
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
export class Stats extends BaseSchema {
  @Prop({ required: true, type: String, index: true })
  metric: string;

  @Prop({ required: true, type: String })
  region: string;

  @Prop({ required: true, type: Number })
  value: number;

  @Prop({ required: false, type: Date, index: true })
  time: Date;

  @Prop({ required: true, type: String, maxlength: 4 })
  period: string;

  @Virtual({
    get(this: any) {
      return this.id;
    },
    set(this: any, id: string) {
      this.id = id;
    }
  })
  $id: string;
}

export const StatsSchema = SchemaFactory.createForClass(Stats);
