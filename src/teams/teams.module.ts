import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { ProjectMiddleware } from 'src/core/resolver/middlewares/project.middleware';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [BullModule.registerQueue({ name: 'mails' })],
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ProjectMiddleware).forRoutes(TeamsController);
  }
}
