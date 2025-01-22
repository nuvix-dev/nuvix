import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { ProjectMiddleware } from 'src/core/resolver/middlewares/project.middleware';

@Module({
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ProjectMiddleware).forRoutes(AccountController);
  }
}
