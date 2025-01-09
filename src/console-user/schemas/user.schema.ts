import { Prop, Schema, SchemaFactory, Virtual } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import {
  Identities,
  Session,
  SessionDocument,
} from 'src/console-account/schemas/account.schema';
import { BaseSchema } from 'src/base/schemas/base.schema';
import Challenges from './challenge.schema';
import Token from './token.schema';
import Authenticator from './authenticator.schema';
import { Membership } from './membersip.schema';

export type UserDocument = HydratedDocument<User>;
export type TargetDocument = HydratedDocument<Target>;

/**
 * Represents a User in the system.
 */
@Schema({
  timestamps: true,
  versionKey: false,
  id: false,
  toJSON: { virtuals: true, minimize: false, useProjection: true },
  toObject: { virtuals: true, minimize: false, useProjection: true },
  virtuals: true,
  minimize: false
})
export class User extends BaseSchema {

  @Prop({ type: String, unique: true, index: true, required: true })
  id: string;

  @Prop({ required: true, type: String, index: true })
  name: string;

  @Prop({ required: true, unique: true, index: true, type: String })
  email: string;

  @Prop({ type: String, maxlength: 16, match: /^\+\d{1,15}$/, index: true })
  phone: string;

  @Prop({ default: false, type: Boolean, index: true })
  emailVerification: boolean;

  @Prop({ default: false, type: Boolean, index: true })
  phoneVerification: boolean;

  @Prop({ default: false, type: Boolean })
  mfa: boolean;

  @Prop({ type: Boolean, default: true, index: true })
  status: boolean;

  @Prop({ type: Boolean, default: false })
  reset: boolean;

  @Prop({ required: true, type: String })
  password: string;

  @Prop({ type: Date, default: null, index: true })
  passwordUpdate: Date;

  @Prop({ type: [String] })
  passwordHistory: string[];

  @Prop({ type: String })
  hash: string;

  @Prop({ type: Object })
  hashOptions: object;

  @Prop({ type: [String] })
  mfaRecoveryCodes: string[];

  @Prop({ type: [String], default: [] })
  labels: string[]

  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  prefs: { [key: string]: any };

  @Prop({ type: Date, default: new Date(), index: true })
  registration: Date;

  @Prop({ type: Date, default: null, index: true })
  accessedAt: Date;

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Identities' }] })
  identities: Identities[];

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Target' }] })
  targets: Target[];

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Session' }] })
  sessions: Session[];

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Challenges' }] })
  challenges: Challenges[];

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Token' }] })
  tokens: Token[];

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Authenticator' }] })
  authenticators: Authenticator[];

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Membership' }] })
  memberships: Membership[]

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

  session: SessionDocument;
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
export class Target extends BaseSchema {
  @Prop({ type: String, required: true, index: true, unique: true })
  id: string;

  @Prop({ type: String, default: "", index: true })
  name: string;

  @Prop({ type: String, index: true })
  userId: string;

  @Prop({ type: mongoose.Types.ObjectId, required: true, index: true })
  userInternalId: mongoose.Types.ObjectId;

  @Prop({ type: String, index: true })
  sessionId: string;

  @Prop({ type: mongoose.Types.ObjectId, required: false, index: true })
  sessionInternalId: mongoose.Types.ObjectId;

  @Prop({ type: String })
  providerId: string | null;

  @Prop({ type: mongoose.Types.ObjectId, index: true })
  providerInternalId: string | null;

  @Prop({ type: String, required: true })
  providerType: string;

  @Prop({ type: String, required: true })
  identifier: string;

  @Prop({ type: Boolean, required: true, default: false })
  expired: boolean;

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


export const UserSchema = SchemaFactory.createForClass(User);
export const TargetSchema = SchemaFactory.createForClass(Target);
