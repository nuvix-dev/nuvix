import { IsObject, IsOptional, IsString } from 'class-validator'

export class SchemaUpdateDTO {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  owner?: string

  @IsOptional()
  @IsObject()
  comment?: { [key: string]: any }
}
