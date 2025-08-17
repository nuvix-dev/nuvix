import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class MembershipModel extends BaseModel {
  /**
   * User ID.
   */
  @Expose() userId: string = '';

  /**
   * User name.
   */
  @Expose() userName: string = '';

  /**
   * User email address.
   */
  @Expose() userEmail: string = '';

  /**
   * Team ID.
   */
  @Expose() teamId: string = '';

  /**
   * Team name.
   */
  @Expose() teamName: string = '';

  /**
   * Date the user has been invited to join the team in ISO 8601 format.
   */
  @Expose() declare invited: string; // No default value

  /**
   * Date the user has accepted the invitation to join the team in ISO 8601 format.
   */
  @Expose() declare joined: string; // No default value

  /**
   * User confirmation status, true if the user has joined the team or false otherwise.
   */
  @Expose() confirm: boolean = false;

  /**
   * Multi-factor authentication status, true if the user has MFA enabled or false otherwise.
   */
  @Expose() mfa: boolean = false;

  /**
   * User list of roles.
   */
  @Expose() roles: string[] = []; // Default to empty array

  constructor(partial: Partial<MembershipModel>) {
    super();
    Object.assign(this, partial);
  }
}
