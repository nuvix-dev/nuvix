import { Prop, Schema, SchemaFactory, Virtual } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { BaseSchema } from "src/base/schemas/base.schema";


export type PaymentMethodDocument = HydratedDocument<PaymentMethod>;

@Schema({
  timestamps: true,
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
export class PaymentMethod extends BaseSchema {
  @Prop({ type: String })
  providerMethodId: string;

  @Prop({ type: String })
  clientSecret: string;

  @Prop({ type: String })
  providerUserId: string;

  @Prop({ type: String })
  userId: string;

  @Prop({ type: Number })
  expiryMonth: number;

  @Prop({ type: Number })
  expiryYear: number;

  @Prop({ type: String })
  last4: string;

  @Prop({ type: String })
  brand: string;

  @Prop({ type: String })
  name: string;

  @Prop({ type: String })
  mandateId: string;

  @Prop({ type: String })
  country: string;

  @Prop({ type: String })
  lastError: string;

  @Prop({ type: Boolean, default: false })
  default: boolean;

  @Prop({ type: Boolean, default: false })
  expired: boolean;

  @Prop({ type: Boolean, default: false })
  failed: boolean;

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

export const PaymentMethodSchema = SchemaFactory.createForClass(PaymentMethod);