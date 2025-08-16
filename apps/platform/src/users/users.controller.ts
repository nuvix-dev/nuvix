import { Body, Controller, Post, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { Public } from '@nuvix/core/resolvers/guards';
import { CreateWaitlistDTO } from './DTO/waitlist.dto';

@Controller({ version: ['1'], path: 'users' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
}
