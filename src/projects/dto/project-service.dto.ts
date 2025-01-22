import { OmitType } from '@nestjs/mapped-types';
import { IsBoolean, IsIn } from 'class-validator';
import { services } from 'src/core/config/services';

export class UpdateProjectServiceDto {
  @IsIn(Object.values(services).map((value) => value.optional && value.key))
  service: string;

  @IsBoolean()
  status: boolean;
}

export class UpdateProjectAllServiceDto extends OmitType(
  UpdateProjectServiceDto,
  ['service'],
) {}
