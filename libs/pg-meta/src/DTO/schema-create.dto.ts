import { IsOptional, IsString } from 'class-validator'

export class SchemaCreateDTO {
  @IsString()
  declare name: string

  @IsOptional()
  @IsString()
  owner?: string
}
