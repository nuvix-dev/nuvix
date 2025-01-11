import { Controller } from '@nestjs/common';
import { TeamsService } from './teams.service';

@Controller({ version: ['1'], path: 'teams' })
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) { }
}
