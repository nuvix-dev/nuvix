import { IsString, IsOptional, IsObject } from 'class-validator';

export class SchemaCreateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsObject()
  comment?: { [key: string]: any };
}
