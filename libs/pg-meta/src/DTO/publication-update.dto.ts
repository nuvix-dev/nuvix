import {
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';

export class PublicationUpdateDTO {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  owner?: string;

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
  tables?: string[] | null;
}
