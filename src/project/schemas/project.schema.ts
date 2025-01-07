import { Prop, Schema, SchemaFactory, Virtual } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { BaseSchema } from 'src/base/schemas/base.schema';
import { Platform } from './platform.schema';
import { Key } from './key.schema';
import { Webhook } from './webhook.schema';

export type ProjectDocument = HydratedDocument<Project>;

type ProjectService = {
  name: string;
  status: boolean;
}

type ProjectApi = {}

type ProjectSmtp = {}

type ProjectTemplate = {}

export interface AuthConfig {
  limit: number;
  maxSessions: number;
  passwordHistory: number;
  passwordDictionary: boolean;
  duration: number;
  personalDataCheck: boolean;
  mockNumbers: string[];
  sessionAlerts: boolean;
  [key: string]: any;
}


type ProjectOAuthProvider = {}

/**
 * Represents a project with its details.
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
export class Project extends BaseSchema {
  @Prop({ required: true, type: String, index: true })
  orgInternalId: string;

  @Prop({ required: false, type: String, index: true })
  orgId: string;

  @Prop({ required: false, type: String, maxlength: 128 })
  name: string;

  @Prop({ required: false, type: String, maxlength: 128 })
  region: string;

  @Prop({ required: false, type: String, maxlength: 256 })
  description: string;

  @Prop({ required: true, type: String, maxlength: 256 })
  database: string;

  @Prop({ required: false, type: String })
  logo: string;

  @Prop({ required: false, type: String, maxlength: 16384 })
  url: string;

  @Prop({ required: false, type: String, maxlength: 16 })
  version: string;

  @Prop({ required: false, type: String, maxlength: 256 })
  legalName: string;

  @Prop({ required: false, type: String, maxlength: 256 })
  legalCountry: string;

  @Prop({ required: false, type: String, maxlength: 256 })
  legalState: string;

  @Prop({ required: false, type: String, maxlength: 256 })
  legalCity: string;

  @Prop({ required: false, type: String, maxlength: 256 })
  legalAddress: string;

  @Prop({ required: false, type: String, maxlength: 256 })
  legalTaxId: string;

  @Prop({ required: false, type: Date })
  accessedAt: Date;

  @Prop({
    required: false, type: [{
      name: { type: String, required: true, maxlength: 128 },
      status: { type: Boolean, required: true, default: true }
    }], default: []
  })
  services: ProjectService[];

  @Prop({
    required: false, type: [{

    }], default: []
  })
  apis: ProjectApi[];

  @Prop({
    required: false, type: [

    ], default: []
  })
  smtp: ProjectSmtp[];

  @Prop({
    required: false, type: mongoose.Schema.Types.Mixed, default: []
  })
  templates: any[];

  @Prop({ required: false, type: mongoose.Schema.Types.Mixed, default: [] })
  auths: AuthConfig[];

  @Prop({ required: false, type: [], default: [] })
  oAuthProviders: ProjectOAuthProvider[];

  @Prop({ required: false, type: mongoose.Types.ObjectId, index: true, ref: 'Platform' })
  platforms: Platform[];

  @Prop({ required: false, type: mongoose.Types.ObjectId, ref: 'Webhook' })
  webhooks: Webhook[];

  @Prop({ required: false, type: mongoose.Types.ObjectId, index: true, ref: 'Key' })
  keys: Key[];

  @Prop({ required: false, type: String, maxlength: 16384 })
  search: string[];

  @Virtual({
    get(this: any) {
      return this.orgId;
    },
    set(this: any, teamId: string) {
      this.orgId = teamId;
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

export const ProjectSchema = SchemaFactory.createForClass(Project);
