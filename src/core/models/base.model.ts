import { Exclude, Expose } from "class-transformer";
import mongoose, { Document } from "mongoose";
import { dataToObject } from "../helper/model.helper";

@Exclude()
export default abstract class BaseModel {
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

  @Exclude() _id: mongoose.Types.ObjectId | any;
  @Exclude() id: string;

  constructor(doc?: any) {
    if (doc) {
      Object.assign(this, dataToObject(doc));
    }
  }
}


interface BaseListModelInterface<T> {
  fromDocuments(docs: Document[]): T[];
}

@Exclude()
export abstract class BaseListModel {
  @Expose() total: number;

  constructor() { }
}