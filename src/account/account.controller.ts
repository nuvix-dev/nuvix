import { Controller } from '@nestjs/common';
import { AccountService } from './account.service';

@Controller({ version: ['1'], path: 'account' })
export class AccountController {
  constructor(private readonly accountService: AccountService) {}
}
