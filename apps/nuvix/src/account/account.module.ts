import { Module } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [BullModule.registerQueue({ name: 'mails' })],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
