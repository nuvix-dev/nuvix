import { Prop, Schema, SchemaFactory, Virtual } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { BaseSchema } from "src/base/schemas/base.schema";

export type CouponDocument = HydratedDocument<Coupon>;
export type CreditDocument = HydratedDocument<Credit>;

@Schema({
  timestamps: true,
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
export class Coupon extends BaseSchema {
  @Prop({ type: String })
  code: string;

  /**
   * Provided credit amount
   */
  @Prop({ type: Number })
  credits: number;

  /**
   * Coupon expiration time in ISO 8601 format.
   */
  @Prop({ type: String })
  expiration: string;

  /**
   * Credit validity in days.
   */
  @Prop({ type: Number })
  validity: number;

  /**
   * Campaign the coupon is associated with.
   */
  @Prop({ type: String })
  campaign: string;

  /**
   * Status of the coupon. Can be one of `disabled`, `active` or `expired`.
   */
  @Prop({ type: String })
  status: string;

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


@Schema({
  timestamps: true,
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
export class Credit extends BaseSchema {
  @Prop({ type: String })
  couponId: string;

  /**
   * ID of the User.
   */
  @Prop({ type: String })
  userId: string;

  /**
   * ID of the Team.
   */
  @Prop({ type: String })
  orgId: string;

  /**
   * Provided credit amount
   */
  @Prop({ type: Number })
  credits: number;

  /**
   * Provided credit amount
   */
  @Prop({ type: Number })
  total: number;

  /**
   * Credit expiration time in ISO 8601 format.
   */
  @Prop({ type: String })
  expiration: string;

  /**
   * Status of the credit. Can be one of `disabled`, `active` or `expired`.
   */
  @Prop({ type: String })
  status: string;

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

export const CouponSchema = SchemaFactory.createForClass(Coupon);
export const CreditSchema = SchemaFactory.createForClass(Credit);