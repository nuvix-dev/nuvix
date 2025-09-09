import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { JwtModule } from '@nestjs/jwt';
import { JWT_SECRET, QueueFor } from '@nuvix/utils';
import { BullModule } from '@nestjs/bullmq';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  imports: [
    BullModule.registerQueue({ name: QueueFor.STATS }),
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
  ],
})
export class UsersModule {}
