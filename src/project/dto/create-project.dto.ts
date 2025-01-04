import { IsString, IsNotEmpty, IsArray, ValidateNested, ArrayMinSize, IsEmpty, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProjectDto {
    @IsString()
    @IsNotEmpty()
    projectId: string;

    @IsNotEmpty()
    @IsString()
    name: string;

    @IsString()
    @IsNotEmpty()
    teamId: string;

    @IsString()
    @IsNotEmpty()
    region: string;

    @IsOptional()
    @IsString()
    description: string;

    @IsOptional()
    @IsString()
    logo: string;

    @IsOptional()
    @IsString()
    url: string;

    @IsOptional()
    @IsString()
    legalName: string;

    @IsOptional()
    @IsString()
    legalCountry: string;

    @IsOptional()
    @IsString()
    legalState: string;

    @IsOptional()
    @IsString()
    legalCity: string;

    @IsOptional()
    @IsString()
    legalAddress: string;

    @IsOptional()
    @IsString()
    legalTaxId: string;
}