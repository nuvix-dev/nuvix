import { OmitType } from '@nestjs/swagger';
import { IsBoolean, IsIn } from 'class-validator';
import apis from '@nuvix/core/config/apis';

export class ProjectApiStatusDTO {
  @IsIn(Object.values(apis).map(api => api.key))
  api!: string;

  @IsBoolean()
  status!: boolean;
}

export class ProjectApiStatusAllDTO extends OmitType(ProjectApiStatusDTO, [
  'api',
] as const) {}
