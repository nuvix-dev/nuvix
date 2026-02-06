import { Exclude, Expose } from 'class-transformer'
import { BaseModel } from './base.model'

@Exclude()
export class EnvToken extends BaseModel {
  @Expose() declare projectId?: string
  @Expose() declare name: string
  @Expose() declare token: string
  @Expose() declare metadata?: Record<string, any>
}
