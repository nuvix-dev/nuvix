import { Controller, UseGuards } from '@nestjs/common';
import { AccountService } from './account.service';
import { ProjectGuard } from 'src/core/resolver/guards/project.guard';

@Controller({ version: ['1'], path: 'account' })
@UseGuards(ProjectGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}
}
