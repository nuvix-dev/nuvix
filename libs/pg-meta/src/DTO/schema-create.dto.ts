import { IsString, IsOptional } from 'class-validator';

export class SchemaCreateDTO {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  owner?: string;
}
