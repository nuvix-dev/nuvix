import { Prop, Schema, SchemaFactory, Virtual } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { BaseSchema } from "src/base/schemas/base.schema";

export type BillingAddressDocument = HydratedDocument<BillingAddress>;

@Schema({
  timestamps: { createdAt: "$createdAt" },
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
/**
 * Schema representing a billing address.
 */
export class BillingAddress extends BaseSchema {
  @Prop({ type: String, required: true })
  userId: string;

  @Prop({ type: String, required: true })
  streetAddress: string;

  @Prop({ type: String })
  addressLine2: string;

  @Prop({ type: String, required: true })
  country: string;

  @Prop({ type: String, required: true })
  city: string;

  @Prop({ type: String, required: true })
  state: string;

  @Prop({ type: String, required: true })
  postalCode: string;

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
      return this.orgId;
    },
  })
  teamId: string;
}

export const BillingAddressSchema = SchemaFactory.createForClass(BillingAddress)