import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { ProjectMiddleware } from 'src/core/resolver/middlewares/project.middleware';
import { GlobalMongooseModule } from 'src/core/resolver/mongoose.resolver';
import { Project, ProjectSchema } from 'src/projects/schemas/project.schema';
import { connectionFactory } from 'src/core/db.provider';

@Module({
  controllers: [TeamsController],
  providers: [TeamsService, connectionFactory],
  imports: [
    GlobalMongooseModule.forFeature(
      [{ name: Project.name, schema: ProjectSchema }],
      'server',
    ),
  ],
})
export class TeamsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ProjectMiddleware).forRoutes(TeamsController);
  }
}
