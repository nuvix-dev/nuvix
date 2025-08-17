import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class TableCreateDTO {
  @IsString()
  declare name: string;

  @IsOptional()
  @IsString()
  schema?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsObject()
  columns?: any[];

  @IsOptional()
  @IsObject()
  primaryKeys?: any[];

  @IsOptional()
  @IsObject()
  foreignKeys?: any[];

  @IsOptional()
  @IsBoolean()
  isPartition?: boolean;

  @IsOptional()
  @IsString()
  partitionOf?: string;

  @IsOptional()
  @IsObject()
  partitioning?: {
    strategy: string;
    columns: any[];
  };
}
