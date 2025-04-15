import { Controller } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller({ version: ['1'], path: 'console/users' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
}
