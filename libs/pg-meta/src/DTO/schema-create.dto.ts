import { IsString, IsOptional } from 'class-validator';

export class SchemaCreateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  owner?: string;
}
