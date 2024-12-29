import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import {
  Identities,
  Session,
  SessionDocument,
} from 'src/account/schemas/account.schema';

export type UserDocument = HydratedDocument<User>;
export type OrganizationDocument = HydratedDocument<Organization>;

/**
 * Represents a User in the system.
 */
@Schema()
export class User {
  @Prop({ required: true, unique: true, index: true, type: String })
  id: string;

  /**
   * The email address of the user.
   * @type {string}
   * @memberof User
   * @required
   */
  @Prop({ required: true, unique: true, index: true, type: String })
  email: string;

  /**
   * The password of the user.
   * @type {string}
   * @memberof User
   * @required
   */
  @Prop({ required: true, type: String })
  password: string;

  /**
   * The name of the user.
   * @type {string}
   * @memberof User
   * @required
   */
  @Prop({ required: true, type: String })
  name: string;

  /**
   * The identities associated with the user.
   * @type {Identities[]}
   * @memberof User
   */
  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Identities' }] })
  identities: Identities[];

  /**
   * Indicates whether multi-factor authentication (MFA) is enabled for the user.
   * @type {boolean}
   * @memberof User
   * @default false
   */
  @Prop({ default: false, type: Boolean })
  mfa: boolean;

  /**
   * Indicates whether the user's email is verified.
   * @type {boolean}
   * @memberof User
   * @default false
   */
  @Prop({ default: false, type: Boolean })
  emailVerified: boolean;

  /**
   * The sessions associated with the user.
   * @type {Session[]}
   * @memberof User
   */
  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Session' }] })
  sessions: Session[];

  @Prop({ type: mongoose.Schema.Types.Mixed })
  prefs: any;

  session: SessionDocument;
}

/**
 * Represents an organization with a unique identifier, name, and associated users.
 */
@Schema()
export class Organization {
  @Prop({ required: true, unique: true, index: true, type: String })
  id: string;

  @Prop({ required: true, type: String, index: true })
  userId: string;

  @Prop({ required: true, type: String })
  name: string;

  @Prop({ required: true, type: Date })
  $createdAt: Date;

  @Prop({ required: true, type: Date })
  $updatedAt: Date;

  @Prop({ type: Number })
  total: number;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  prefs: any;

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
}

export const UserSchema = SchemaFactory.createForClass(User);
export const OrganizationSchema = SchemaFactory.createForClass(Organization);
