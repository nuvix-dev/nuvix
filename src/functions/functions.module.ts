import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { FunctionsService } from './functions.service';
import { FunctionsController } from './functions.controller';
import { ProjectMiddleware } from 'src/core/resolvers/middlewares/project.middleware';

@Module({
  controllers: [FunctionsController],
  providers: [FunctionsService],
})
export class FunctionsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ProjectMiddleware).forRoutes(FunctionsController);
  }
}
