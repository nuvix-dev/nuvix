import { Type } from 'class-transformer';

import {
    IsString, IsOptional, IsBoolean, IsArray, ValidateNested,
    IsNumber, IsEnum, IsObject, IsNotEmpty, IsDefined
} from 'class-validator';

export class ValidationDto {
    @IsOptional()
    @IsNumber()
    min?: number;

    @IsOptional()
    @IsNumber()
    max?: number;

    @IsOptional()
    @IsString()
    regex?: string;
}

export class ReferencesDto {
    @IsString()
    schema: string;

    @IsString()
    table: string;

    @IsString()
    column: string;

    @IsOptional()
    @IsEnum(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION'])
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';

    @IsOptional()
    @IsEnum(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION'])
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export class ColumnDto {
    @IsString()
    name: string;

    @IsString()
    type: string;

    @IsOptional()
    @IsBoolean()
    primary_key?: boolean;

    @IsOptional()
    @IsString()
    comment?: string;

    @IsOptional()
    default?: any;

    @IsOptional()
    @IsBoolean()
    not_null?: boolean;

    @IsOptional()
    @IsBoolean()
    unique?: boolean;

    @IsOptional()
    @IsBoolean()
    array?: boolean;

    @IsOptional()
    @IsString()
    collation?: string;

    @IsOptional()
    @IsBoolean()
    enum?: boolean;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    elements?: string[];

    @IsOptional()
    @IsObject()
    $permissions?: Record<string, any>;

    @IsOptional()
    @IsEnum(['lz4', 'pglz'])
    compression?: 'lz4' | 'pglz';

    @IsOptional()
    @IsEnum(['ALWAYS', 'STORED'])
    generated?: 'ALWAYS' | 'STORED';

    @IsOptional()
    @ValidateNested()
    @Type(() => ValidationDto)
    validation?: ValidationDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => ReferencesDto)
    references?: ReferencesDto;
}

export class IndexDto {
    @IsString()
    name: string;

    @IsArray()
    @IsString({ each: true })
    columns: string[];

    @IsEnum(['BTREE', 'GIN', 'HASH', 'BRIN', 'GIST'])
    type: 'BTREE' | 'GIN' | 'HASH' | 'BRIN' | 'GIST';

    @IsOptional()
    @IsBoolean()
    unique?: boolean;

    @IsOptional()
    @IsString()
    where?: string;

    @IsOptional()
    @IsBoolean()
    concurrently?: boolean;
}

export class StorageParametersDto {
    @IsOptional()
    @IsNumber()
    fillfactor?: number;
}

export class PartitionItemDto {
    @IsString()
    name: string;

    @IsObject()
    values: Record<string, any>;

    @IsOptional()
    @IsString()
    parent?: string;
}

export class PartitionDto {
    @IsEnum(['RANGE', 'LIST', 'HASH'])
    strategy: 'RANGE' | 'LIST' | 'HASH';

    @IsString()
    column: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PartitionItemDto)
    partitions: PartitionItemDto[];
}

export class CreateTableDto {
    @IsString()
    @IsNotEmpty()
    $id: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    schema: string;

    @IsOptional()
    @IsString()
    comment?: string;

    @IsOptional()
    @IsBoolean()
    rls?: boolean = false;

    @IsOptional()
    @IsBoolean()
    cls?: boolean = false;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    $permissions?: string[];

    @IsOptional()
    @ValidateNested()
    @Type(() => StorageParametersDto)
    storage_parameters?: StorageParametersDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => PartitionDto)
    partition?: PartitionDto;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    inherits?: string[];

    @IsDefined()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ColumnDto)
    columns: ColumnDto[];

    @IsDefined()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => IndexDto)
    indexes: IndexDto[];
}