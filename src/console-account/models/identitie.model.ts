import { Exclude, Expose } from "class-transformer";
import BaseModel, { BaseListModel } from "src/core/models/base.model";


@Exclude()
export class IdentitieModel extends BaseModel {
  /**
   * User ID.
   */
  @Expose() userId: string;
  /**
   * Identity Provider.
   */
  @Expose() provider: string;
  /**
   * ID of the User in the Identity Provider.
   */
  @Expose() providerUid: string;
  /**
   * Email of the User in the Identity Provider.
   */
  @Expose() providerEmail: string;
  /**
   * Identity Provider Access Token.
   */
  @Expose() providerAccessToken: string;
  /**
   * The date of when the access token expires in ISO 8601 format.
   */
  @Expose() providerAccessTokenExpiry: string;
  /**
   * Identity Provider Refresh Token.
   */
  @Expose() providerRefreshToken: string;

  constructor(data: Partial<IdentitieModel | any>) {
    super(data);
  }

}


export class IdentitieListModel extends BaseListModel {
  @Expose() identities: Partial<IdentitieModel[]>;

  constructor(data: IdentitieListModel | any) {
    super();
    this.identities = data.identities.map((identitie: IdentitieModel) => new IdentitieModel(identitie));
    this.total = data.total;
  }
}