import { Prop, Schema, SchemaFactory, Virtual } from '@nestjs/mongoose';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { BaseSchema } from 'src/base/schemas/base.schema';
import { ID } from 'src/core/helper/ID.helper';

export type IdentitiesDocument = HydratedDocument<Identities>;
export type SessionDocument = HydratedDocument<Session>;

/**
 * Represents the schema for identity providers.
 *
 * @schema Identities
 * @property {string} provider - The name of the identity provider (e.g., Google, Facebook).
 * @property {string} providerId - The unique identifier for the user from the identity provider.
 * @property {string} [accessToken] - The access token provided by the identity provider.
 * @property {string} [refreshToken] - The refresh token provided by the identity provider.
 * @property {number} [expiresIn] - The duration (in seconds) for which the access token is valid.
 * @property {string} [tokenType] - The type of the token provided by the identity provider.
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
export class Identities extends BaseSchema {

  @Prop({ type: String, required: true, index: true, unique: true, default: ID.unique() })
  id: string;

  @Prop({ required: true, type: String })
  userId: string;

  @Prop({ required: true, type: String, index: true })
  userInternalId: string;

  @Prop({ type: String, default: null })
  provider: string;

  @Prop({ default: null, type: String })
  providerUid: string;

  @Prop({ type: String })
  providerEmail: string;

  @Prop({ type: String })
  providerAccessToken: string;

  @Prop({ type: Date })
  providerAccessTokenExpiry: Date;

  @Prop({ type: String })
  providerRefreshToken: string;

  @Prop({ type: mongoose.Schema.Types.Mixed })
  secrets: any;

  @Virtual({
    get(this: any) {
      return this.id;
    },
    set(...args) {
      this.id = args[0];
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

/**
 * Represents a user session.
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
export class Session extends BaseSchema {
  @Prop({ type: String, required: true, index: true, unique: true, default: ID.unique() })
  id: string;

  @Prop({ required: true, type: String })
  userId: string;

  @Prop({ required: true, type: String, index: true })
  userInternalId: string;

  @Prop({ required: true, type: String })
  expire: string;

  @Prop({ type: String })
  provider: string;

  @Prop({ type: String, index: true })
  providerUid: string;

  @Prop({ type: String })
  providerAccessToken: string;

  @Prop({ type: String })
  providerAccessTokenExpiry: string;

  @Prop({ type: String })
  providerRefreshToken: string;

  @Prop({ type: String })
  userAgent: string;

  @Prop({ type: String })
  countryCode: string;

  @Prop({ type: String })
  ip: string;

  @Prop({ type: String })
  osCode: string;

  @Prop({ type: String })
  osName: string;

  @Prop({ type: String })
  osVersion: string;

  @Prop({ type: String })
  clientType: string;

  @Prop({ type: String })
  clientCode: string;

  @Prop({ type: String })
  clientName: string;

  @Prop({ type: String })
  clientVersion: string;

  @Prop({ type: String })
  clientEngine: string;

  @Prop({ type: String })
  clientEngineVersion: string;

  @Prop({ type: String })
  deviceName: string;

  @Prop({ type: String })
  deviceBrand: string;

  @Prop({ type: String })
  deviceModel: string;

  @Prop({ type: String })
  countryName: string;

  @Prop({ type: [String] })
  factors: string[];

  @Prop({ type: String })
  secret: string;

  @Prop({ type: String })
  mfaUpdatedAt: string;

  @Virtual({
    get(this: any) {
      return this.id;
    },
    set(...args) {
      this.id = args[0];
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

export const IdentitiesSchema = SchemaFactory.createForClass(Identities);
export const SessionSchema = SchemaFactory.createForClass(Session);
