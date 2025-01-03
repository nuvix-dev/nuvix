import { Prop, Schema, SchemaFactory, Virtual } from "@nestjs/mongoose";
import mongoose, { HydratedDocument } from "mongoose";
import { BaseSchema } from "src/base/schemas/base.schema";


export type OrganizationDocument = HydratedDocument<Organization>;

/**
 * Represents an organization with a unique identifier, name, and associated users.
 */
@Schema({
  timestamps: { createdAt: "$createdAt" },
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
export class Organization extends BaseSchema {
  @Prop({ type: String, unique: true, index: true, required: true })
  id: string;

  @Prop({ required: true, type: String })
  name: string;

  @Prop({ type: Number })
  total: number;

  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  prefs: { [key: string]: any };

  @Prop({ type: Number })
  billingBudget: number;

  @Prop({ type: [String] })
  budgetAlerts: string[];

  @Prop({ type: String })
  billingPlan: string;

  @Prop({ type: String })
  billingEmail: string;

  @Prop({ type: String })
  billingStartDate: string;

  @Prop({ type: String })
  billingCurrentInvoiceDate: string;

  @Prop({ type: String })
  billingNextInvoiceDate: string;

  @Prop({ type: String })
  billingTrialStartDate: string;

  @Prop({ type: Number })
  billingTrialDays: number;

  @Prop({ type: String })
  billingAggregationId: string;

  @Prop({ type: String })
  paymentMethodId: string;

  @Prop({ type: String })
  billingAddressId: string;

  @Prop({ type: String })
  backupPaymentMethodId: string;

  @Prop({ type: String })
  agreementBAA: string;

  @Prop({ type: String })
  programManagerName: string;

  @Prop({ type: String })
  programManagerCalendar: string;

  @Prop({ type: String })
  programDiscordChannelName: string;

  @Prop({ type: String })
  programDiscordChannelUrl: string;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  billingLimits: object;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  billingPlanDowngrade: object;

  @Prop({ type: String })
  billingTaxId: string;

  @Prop({ required: true, type: Boolean, default: false })
  markedForDeletion: boolean;

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


export const OrganizationSchema = SchemaFactory.createForClass(Organization);
