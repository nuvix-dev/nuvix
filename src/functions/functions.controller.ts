import { Controller, UseGuards } from '@nestjs/common';
import { FunctionsService } from './functions.service';
import { ProjectGuard } from 'src/core/resolver/guards/project.guard';

@Controller('functions')
@UseGuards(ProjectGuard)
export class FunctionsController {
  constructor(private readonly functionsService: FunctionsService) {}
}
