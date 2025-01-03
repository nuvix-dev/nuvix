import { Exclude, Expose } from 'class-transformer';
import { Document } from 'mongoose';
import { dataToObject } from 'src/core/helper/model.helper';
import BaseModel from 'src/core/models/base.model';


@Exclude()
export class MembershipModel extends BaseModel {
  /**
   * User ID.
   */
  @Expose() userId: string = "";
  /**
   * User name. Hide this attribute by toggling membership privacy in the Console.
   */
  @Expose() userName: string = "";
  /**
   * User email address. Hide this attribute by toggling membership privacy in the Console.
   */
  @Expose() userEmail: string = "";
  /**
 * Team ID.
 */
  @Expose() orgId: string = "";
  /**
   * Team name.
   */
  @Expose() orgName: string = "";
  /**
   * INTERNAL USE ONLY.
   * Team ID. 
   */
  @Expose() teamId: string = "";
  /**
   * INTERNAL USE ONLY.
   * Team name.
   */
  @Expose() teamName: string = "";
  /**
   * Date, the user has been invited to join the team in ISO 8601 format.
   */
  @Expose() invited: string = "";
  /**
   * Date, the user has accepted the invitation to join the team in ISO 8601 format.
   */
  @Expose() joined: string = "";
  /**
   * User confirmation status, true if the user has joined the team or false otherwise.
   */
  @Expose() confirm: boolean = false;
  /**
   * Multi factor authentication status, true if the user has MFA enabled or false otherwise. Hide this attribute by toggling membership privacy in the Console.
   */
  @Expose() mfa: boolean = false;
  /**
   * User list of roles
   */
  @Expose() roles: string[] = [];

  constructor(partial: Partial<MembershipModel> | Document) {
    super();
    Object.assign(this, dataToObject(partial));
  }
}

export class MembershipsListModel {
  /**
   * Total number of organizations.
   */
  total: number = 0;

  /**
   * List of organizations.
   */
  memberships: MembershipModel[] = [];

  constructor(partial: Partial<MembershipsListModel | { memberships: Document[] | { [key: string]: string }[] }>) {
    if (partial.memberships) {
      this.memberships = partial.memberships.map((mb) => new MembershipModel(mb));
    }
    Object.assign(this, { ...partial, memberships: this.memberships });
  }
}