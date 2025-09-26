import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateProjectDTO } from './create-project.dto';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateProjectDTO extends PartialType(
  OmitType(CreateProjectDTO, ['region', 'teamId', 'projectId'] as const),
) {}

export class UpdateProjectTeamDTO {
  @IsNotEmpty()
  @IsString()
  declare teamId: string;
}
