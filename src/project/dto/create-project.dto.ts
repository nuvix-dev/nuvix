import { IsString, IsNotEmpty, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class ServiceDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    status: string;
}

export class CreateProjectDto {
    @IsString()
    @IsNotEmpty()
    $id: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    orgnizationId: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ServiceDto)
    @ArrayMinSize(0)
    services: ServiceDto[];
}