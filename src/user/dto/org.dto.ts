import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { PartialType } from "@nestjs/mapped-types"


export class CreateOrgDto {
    @IsString()
    @IsNotEmpty()
    $id: string

    @IsString()
    @IsNotEmpty()
    name: string
}

export class UpdateOrgDto extends PartialType(CreateOrgDto) { }