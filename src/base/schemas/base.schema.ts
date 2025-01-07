import { Prop, Schema, Virtual } from "@nestjs/mongoose";
import { ID } from "src/core/helper/ID.helper";



export abstract class BaseSchema {

  @Prop({ type: String, index: true, unique: true, default: ID.unique() })
  id: string;

  @Prop({ type: Date, default: null })
  deletedAt: Date;

  @Prop({ type: [String], default: [] })
  permissions: string[];

}