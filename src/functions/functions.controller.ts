import { Controller, UseGuards } from '@nestjs/common';
import { FunctionsService } from './functions.service';
import { ProjectGuard } from 'src/core/resolvers/guards/project.guard';

@Controller('functions')
@UseGuards(ProjectGuard)
export class FunctionsController {
  constructor(private readonly functionsService: FunctionsService) {}
}
