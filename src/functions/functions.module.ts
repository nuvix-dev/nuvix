import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { FunctionsService } from './functions.service';
import { FunctionsController } from './functions.controller';
import { ProjectMiddleware } from 'src/core/resolver/middlewares/project.middleware';
import { GlobalMongooseModule } from 'src/core/resolver/mongoose.resolver';
import { Project, ProjectSchema } from 'src/projects/schemas/project.schema';

@Module({
  controllers: [FunctionsController],
  providers: [FunctionsService],
  imports: [
    GlobalMongooseModule.forFeature(
      [{ name: Project.name, schema: ProjectSchema }],
      'server',
    ),
  ],
})
export class FunctionsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ProjectMiddleware).forRoutes(FunctionsController);
  }
}
