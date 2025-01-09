import { Document } from "mongoose";
import { ClsService, ClsServiceManager } from "nestjs-cls";
import { Authorization } from "../validators/authorization.validator";
import { Input } from "../validators/authorization-input.validator";
import { Database } from "../config/database";


export class ModelResolver<T> {
  private readonly document: Document<T>;
  private readonly cls: ClsService;

  constructor(document: Document<T>) {
    this.document = document;
    this.cls = ClsServiceManager.getClsService();
  }

  private isAuthorized(): boolean {
    const authorization = this.cls.get('authorization') as Authorization;
    const input = new Input(Database.PERMISSION_READ, (this.document as any).getRead());
    return authorization.isValid(input);
  }

  public getDocument(): Document<T> | undefined {
    if (this.document && this.isAuthorized()) {
      return this.document;
    }
    return undefined;
  }
}
