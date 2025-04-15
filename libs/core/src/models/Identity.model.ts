import { Exclude, Expose } from 'class-transformer';
import BaseModel from '@nuvix/core/models/base.model';

@Exclude()
export class IdentityModel extends BaseModel {
  /**
   * Identity ID.
   */
  @Expose() id: string = '';

  /**
   * Identity creation date in ISO 8601 format.
   */
  @Expose() createdAt: string; // No default value

  /**
   * Identity update date in ISO 8601 format.
   */
  @Expose() updatedAt: string; // No default value

  /**
   * User ID.
   */
  @Expose() userId: string = '';

  /**
   * Identity Provider.
   */
  @Expose() provider: string = '';

  /**
   * ID of the User in the Identity Provider.
   */
  @Expose() providerUid: string = '';

  /**
   * Email of the User in the Identity Provider.
   */
  @Expose() providerEmail: string = '';

  /**
   * Identity Provider Access Token.
   */
  @Expose() providerAccessToken: string = '';

  /**
   * The date of when the access token expires in ISO 8601 format.
   */
  @Expose() providerAccessTokenExpiry: string; // No default value

  /**
   * Identity Provider Refresh Token.
   */
  @Expose() providerRefreshToken: string = '';

  constructor(partial: Partial<IdentityModel>) {
    super();
    Object.assign(this, partial);
  }

  /**
   * Get Name
   *
   * @return string
   */
  getName(): string {
    return 'Identity';
  }
}
