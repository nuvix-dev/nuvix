import { Prop, Schema, Virtual } from "@nestjs/mongoose";
import { Database } from "src/core/config/database";
import { ID } from "src/core/helper/ID.helper";



export abstract class BaseSchema {

  @Prop({ type: String, index: true, unique: true, default: ID.unique() })
  id: string;

  @Prop({ type: Date, default: null })
  deletedAt: Date;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  public getPermissions(): string[] {
    return Array.from(new Set(this.permissions || []));
  }

  public getRead(): string[] {
    return this.getPermissionsByType(Database.PERMISSION_READ);
  }

  public getCreate(): string[] {
    return this.getPermissionsByType(Database.PERMISSION_CREATE);
  }

  public getUpdate(): string[] {
    return this.getPermissionsByType(Database.PERMISSION_UPDATE);
  }

  public getDelete(): string[] {
    return this.getPermissionsByType(Database.PERMISSION_DELETE);
  }

  public getWrite(): string[] {
    return Array.from(new Set([
      ...this.getCreate(),
      ...this.getUpdate(),
      ...this.getDelete()
    ]));
  }

  public getPermissionsByType(type: string): string[] {
    const typePermissions: string[] = [];

    for (const permission of this.getPermissions()) {
      if (!permission.startsWith(type)) {
        continue;
      }
      typePermissions.push(permission.replace(new RegExp(`^${type}\\(|\\)|"|\\s`, 'g'), ''));
    }

    return Array.from(new Set(typePermissions));
  }

  public find(key: string, find: any, subject: string = ''): any {
    let subjectValue = this[subject] ?? null;
    subjectValue = (subjectValue === null || subjectValue === undefined) ? this : subjectValue;

    if (Array.isArray(subjectValue)) {
      for (const value of subjectValue) {
        if (value[key] === find) {
          return value;
        }
        return false;
      }

      if (subjectValue[key] === find) {
        return subjectValue;
      }
      return false;
    }
  }

}