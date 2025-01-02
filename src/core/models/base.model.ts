import { Exclude, Expose } from "class-transformer";

@Exclude()
export default class BaseModel {
  /**
 *  ID.
 */
  @Expose() $id: string;
  /**
   * User creation date in ISO 8601 format.
   */
  @Expose() $createdAt: Date;
  /**
   * User update date in ISO 8601 format.
   */
  @Expose() $updatedAt: Date;

  @Exclude() _id: string;
  @Exclude() id: string;
}