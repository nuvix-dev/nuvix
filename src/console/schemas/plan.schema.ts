import { Prop, Schema, SchemaFactory, Virtual } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { BaseSchema } from "src/base/schemas/base.schema";

export type PlanDocument = HydratedDocument<Plan>;


@Schema({
  timestamps: true,
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
export class Plan extends BaseSchema {
  @Prop({ type: String })
  /**
   * Plan name
   */
  name: string;

  @Prop({ type: Number })
  /**
   * Price
   */
  price: number;

  @Prop({ type: Number })
  /**
   * Trial days
   */
  trial: number;

  @Prop({ type: Number })
  /**
   * Bandwidth
   */
  bandwidth: number;

  @Prop({ type: Number })
  /**
   * Storage
   */
  storage: number;

  @Prop({ type: Number })
  /**
   * Members
   */
  members: number;

  @Prop({ type: Number })
  /**
   * Webhooks
   */
  webhooks: number;

  @Prop({ type: Number })
  /**
   * Platforms
   */
  platforms: number;

  @Prop({ type: Number })
  /**
   * Users
   */
  users: number;

  @Prop({ type: Number })
  /**
   * Teams
   */
  teams: number;

  @Prop({ type: Number })
  /**
   * Databases
   */
  databases: number;

  @Prop({ type: Number })
  /**
   * Buckets
   */
  buckets: number;

  @Prop({ type: Number })
  /**
   * File size
   */
  fileSize: number;

  @Prop({ type: Number })
  /**
   * Functions
   */
  functions: number;

  @Prop({ type: Number })
  /**
   * Function executions
   */
  executions: number;

  @Prop({ type: Number })
  /**
   * Realtime connections
   */
  realtime: number;

  @Prop({ type: Number })
  /**
   * Log days
   */
  logs: number;

  @Prop({ type: Object })
  /**
   * Additional resources
   */
  addons: {} // AdditionalResource;

  @Prop({ type: Boolean })
  /**
   * Custom SMTP
   */
  customSmtp: boolean;

  @Prop({ type: Boolean })
  /**
   * Appwrite branding in email
   */
  emailBranding: boolean;

  @Prop({ type: Boolean })
  /**
   * Does plan require payment method
   */
  requiresPaymentMethod: boolean;

  @Prop({ type: Boolean })
  /**
   * Does plan require billing address
   */
  requiresBillingAddress: boolean;

  @Prop({ type: Boolean })
  /**
   * Is the billing plan available
   */
  isAvailable: boolean;

  @Prop({ type: Boolean })
  /**
   * Can user change the plan themselves
   */
  selfService: boolean;


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


export const PlanSchema = SchemaFactory.createForClass(Plan);