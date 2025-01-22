import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { DatabaseController } from './database.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectMiddleware } from 'src/core/resolver/middlewares/project.middleware';
import { GlobalMongooseModule } from 'src/core/resolver/mongoose.resolver';
import { Project, ProjectSchema } from 'src/projects/schemas/project.schema';

@Module({
  controllers: [DatabaseController],
  providers: [DatabaseService],
  imports: [
    GlobalMongooseModule.forFeature(
      [{ name: Project.name, schema: ProjectSchema }],
      'server',
    ),
  ],
})
export class DatabaseModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ProjectMiddleware).forRoutes(DatabaseController);
  }
}
