
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import { Identities, Session, SessionDocument } from 'src/account/schemas/account.schema';

export type UserDocument = HydratedDocument<User>;
export type OrganizationDocument = HydratedDocument<Organization>;

/**
 * Represents a User in the system.
 */
@Schema()
export class User {
  /**
   * The email address of the user.
   * @type {string}
   * @memberof User
   * @required
   */
  @Prop({ required: true })
  email: string;

  /**
   * The password of the user.
   * @type {string}
   * @memberof User
   * @required
   */
  @Prop({ required: true })
  password: string;

  /**
   * The name of the user.
   * @type {string}
   * @memberof User
   * @required
   */
  @Prop({ required: true })
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
  @Prop({ default: false })
  mfa: boolean;

  /**
   * Indicates whether the user's email is verified.
   * @type {boolean}
   * @memberof User
   * @default false
   */
  @Prop({ default: false })
  emailVerified: boolean;

  /**
   * The sessions associated with the user.
   * @type {Session[]}
   * @memberof User
   */
  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Session' }] })
  sessions: Session[];

  session: SessionDocument;
}


/**
 * Represents an organization with a unique identifier, name, and associated users.
 */
export class Organization {
  @Prop({ required: true })
  $id: string

  @Prop({ required: true })
  $userId: string

  @Prop({ required: true })
  name: string;

  @Prop({ type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] })
  users: User[];
}


export const UserSchema = SchemaFactory.createForClass(User);
export const OrganizationSchema = SchemaFactory.createForClass(Organization);