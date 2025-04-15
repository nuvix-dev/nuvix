import { OmitType } from '@nestjs/mapped-types';
import { IsBoolean, IsIn } from 'class-validator';
import { services } from '@nuvix/core/config/services';

export class UpdateProjectServiceDTO {
  @IsIn(Object.values(services).map(value => value.optional && value.key))
  service: string;

  @IsBoolean()
  status: boolean;
}

export class UpdateProjectAllServiceDTO extends OmitType(
  UpdateProjectServiceDTO,
  ['service'],
) {}
