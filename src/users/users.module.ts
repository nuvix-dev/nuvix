import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { connectionFactory } from 'src/core/db.provider';

@Module({
  controllers: [UsersController],
  providers: [UsersService, connectionFactory],
})
export class UsersModule { }
