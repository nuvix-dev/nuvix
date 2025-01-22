import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateProjectDto } from './create-project.dto';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateProjectDto extends PartialType(
  OmitType(CreateProjectDto, ['region', 'teamId', 'projectId']),
) {}

export class UpdateProjectTeamDto {
  @IsNotEmpty()
  @IsString()
  teamId: string;
}
