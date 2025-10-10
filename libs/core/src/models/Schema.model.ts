import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class SchemaModel extends BaseModel {
  @Expose()
  // @ts-ignore
  override get $id() {
    return this.name
  }

  @Expose() declare name: string

  @Expose() description?: string

  @Expose() declare type: 'managed' | 'unmanaged' | 'document'
}
