import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { PartialType } from "@nestjs/mapped-types"


export class CreateOrgDto {
    @IsString()
    @IsNotEmpty()
    organizationId: string

    @IsString()
    @IsNotEmpty()
    name: string

    @IsOptional()
    @IsString()
    plan: string
}

export class UpdateOrgDto extends PartialType(CreateOrgDto) { }