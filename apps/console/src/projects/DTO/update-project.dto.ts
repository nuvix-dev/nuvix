import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateProjectDTO } from './create-project.dto';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateProjectDTO extends PartialType(
  OmitType(CreateProjectDTO, ['region', 'teamId', 'projectId']),
) {}

export class UpdateProjectTeamDTO {
  @IsNotEmpty()
  @IsString()
  teamId: string;
}
