import { Exclude, Expose } from "class-transformer";
import BaseModel, { BaseListModel } from "src/core/models/base.model";


@Exclude()
export class LogModel extends BaseModel {
  /**
   * Event name.
   */
  @Expose() event: string;
  /**
   * User ID.
   */
  @Expose() userId: string;
  /**
   * User Email.
   */
  @Expose() userEmail: string;
  /**
   * User Name.
   */
  @Expose() userName: string;
  /**
   * API mode when event triggered.
   */
  @Expose() mode: string;
  /**
   * IP session in use when the session was created.
   */
  @Expose() ip: string;
  /**
   * Log creation date in ISO 8601 format.
   */
  @Expose() time: string;
  /**
   * Operating system code name. View list of [available options](https://github.com/appwrite/appwrite/blob/master/docs/lists/os.json).
   */
  @Expose() osCode: string;
  /**
   * Operating system name.
   */
  @Expose() osName: string;
  /**
   * Operating system version.
   */
  @Expose() osVersion: string;
  /**
   * Client type.
   */
  @Expose() clientType: string;
  /**
   * Client code name. View list of [available options](https://github.com/appwrite/appwrite/blob/master/docs/lists/clients.json).
   */
  @Expose() clientCode: string;
  /**
   * Client name.
   */
  @Expose() clientName: string;
  /**
   * Client version.
   */
  @Expose() clientVersion: string;
  /**
   * Client engine name.
   */
  @Expose() clientEngine: string;
  /**
   * Client engine name.
   */
  @Expose() clientEngineVersion: string;
  /**
   * Device name.
   */
  @Expose() deviceName: string;
  /**
   * Device brand name.
   */
  @Expose() deviceBrand: string;
  /**
   * Device model name.
   */
  @Expose() deviceModel: string;
  /**
   * Country two-character ISO 3166-1 alpha code.
   */
  @Expose() countryCode: string;
  /**
   * Country name.
   */
  @Expose() countryName: string;

  constructor(data: Partial<LogModel> = {}) {
    super(data);
  }
}


export class LogsListModel extends BaseListModel {
  @Expose() logs: Partial<LogModel[]>;

  constructor(data: Partial<LogsListModel | any> = {}) {
    super();
    this.logs = data.logs ? data.logs.map((log: any) => new LogModel(log)) : [];
    this.total = data.total || 0;
  }
}