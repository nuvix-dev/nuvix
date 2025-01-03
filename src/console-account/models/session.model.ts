import { Exclude, Expose } from "class-transformer";
import { Document } from "mongoose";
import { dataToObject } from "src/core/helper/model.helper";
import BaseModel from "src/core/models/base.model";

@Exclude()
export class SessionModel extends BaseModel {
  /**
   * User ID.
   */
  @Expose() userId: string;
  /**
   * Session expiration date in ISO 8601 format.
   */
  @Expose() expire: string = '';
  /**
   * Session Provider.
   */
  @Expose() provider: string = '';
  /**
   * Session Provider User ID.
   */
  @Expose() providerUid: string = '';
  /**
   * Session Provider Access Token.
   */
  @Expose() providerAccessToken: string = '';
  /**
   * The date of when the access token expires in ISO 8601 format.
   */
  @Expose() providerAccessTokenExpiry: string = '';
  /**
   * Session Provider Refresh Token.
   */
  @Expose() providerRefreshToken: string = '';
  /**
   * IP in use when the session was created.
   */
  @Expose() ip: string = '';
  /**
   * Operating system code name. View list of [available options](https://github.com/nuvix/nuvix/blob/master/docs/lists/os.json).
   */
  @Expose() osCode: string = '';
  /**
   * Operating system name.
   */
  @Expose() osName: string = '';
  /**
   * Operating system version.
   */
  @Expose() osVersion: string = '';
  /**
   * Client type.
   */
  @Expose() clientType: string = '';
  /**
   * Client code name. View list of [available options](https://github.com/nuvix/nuvix/blob/master/docs/lists/clients.json).
   */
  @Expose() clientCode: string = '';
  /**
   * Client name.
   */
  @Expose() clientName: string = '';
  /**
   * Client version.
   */
  @Expose() clientVersion: string = '';
  /**
   * Client engine name.
   */
  @Expose() clientEngine: string = '';
  /**
   * Client engine name.
   */
  @Expose() clientEngineVersion: string = '';
  /**
   * Device name.
   */
  @Expose() deviceName: string = '';
  /**
   * Device brand name.
   */
  @Expose() deviceBrand: string = '';
  /**
   * Device model name.
   */
  @Expose() deviceModel: string = '';
  /**
   * Country two-character ISO 3166-1 alpha code.
   */
  @Expose() countryCode: string = '';
  /**
   * Country name.
   */
  @Expose() countryName: string = '';
  /**
   * Returns true if this the current user session.
   */
  @Expose() current: boolean = false;
  /**
   * Returns a list of active session factors.
   */
  @Expose() factors: string[] = [];
  /**
   * Secret used to authenticate the user. Only included if the request was made with an API key
   */
  @Expose() secret: string = '';
  /**
   * Most recent date in ISO 8601 format when the session successfully passed MFA challenge.
   */
  @Expose() mfaUpdatedAt: string = '';

  constructor(partial: Partial<SessionModel> | Document) {
    super();
    Object.assign(this, dataToObject(partial));
  }
}

export class SessionssListModel {
  /**
   * Total number of Sessions.
   */
  total: number = 0;

  /**
   * List of Sessions.
   */
  sessions: SessionModel[] = [];

  constructor(partial: Partial<SessionssListModel | { sessions: Document[] | { [key: string]: string }[] }>) {
    if (partial.sessions) {
      this.sessions = (partial.sessions as Document[]).map((session) => new SessionModel(session));
    }
    Object.assign(this, { ...partial, sessions: this.sessions });
  }
}
