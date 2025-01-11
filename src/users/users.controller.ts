import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller({ version: ['1'], path: 'users' })
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  async ping() {
    return await this.usersService.ping();
  }
}
