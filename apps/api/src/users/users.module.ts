import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { JwtModule } from '@nestjs/jwt';
import { JWT_SECRET } from '@nuvix/utils';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  imports: [
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
})
export class UsersModule {}
