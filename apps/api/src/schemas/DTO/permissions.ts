import { IsString } from 'class-validator';

export class PermissionsDTO {
  @IsString({ each: true })
  permissions!: string[];
}
