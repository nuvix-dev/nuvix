import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
} from 'class-validator';

export class PublicationCreateDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  publish_insert?: boolean;

  @IsOptional()
  @IsBoolean()
  publish_update?: boolean;

  @IsOptional()
  @IsBoolean()
  publish_delete?: boolean;

  @IsOptional()
  @IsBoolean()
  publish_truncate?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  tables?: string[];
}
