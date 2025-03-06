import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { ProjectMiddleware } from 'src/core/resolvers/middlewares/project.middleware';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [BullModule.registerQueue({ name: 'mails' })],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ProjectMiddleware).forRoutes(AccountController);
  }
}
