import { OmitType } from '@nestjs/swagger';
import { IsBoolean, IsIn } from 'class-validator';
import { services } from '@nuvix/core/config/services';

export class UpdateProjectServiceDTO {
  @IsIn(
    Object.values(services)
      .filter(v => v.optional)
      .map(value => value.key),
  )
  service!: string;

  @IsBoolean()
  status!: boolean;
}

export class UpdateProjectAllServiceDTO extends OmitType(
  UpdateProjectServiceDTO,
  ['service'] as const,
) {}
