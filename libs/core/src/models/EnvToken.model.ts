import { BaseModel } from './base.model';
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class EnvToken extends BaseModel {
  @Expose() declare projectId?: string;
  @Expose() declare name: string;
  @Expose() declare token: string;
  @Expose() declare metadata?: Record<string, any>;
}
