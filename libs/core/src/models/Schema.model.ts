import { Exclude, Expose } from 'class-transformer';
import BaseModel from './base.model';

@Exclude()
export class SchemaModel extends BaseModel {
  @Expose() name: string;

  @Expose() description?: string;

  @Expose() type: 'managed' | 'unmanaged' | 'document';
}
