import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountController } from './account.controller';
import { ProjectMiddleware } from 'src/core/resolver/middlewares/project.middleware';
import { GlobalMongooseModule } from 'src/core/resolver/mongoose.resolver';
import { Project, ProjectSchema } from 'src/projects/schemas/project.schema';

@Module({
  controllers: [AccountController],
  providers: [AccountService],
  imports: [
    GlobalMongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema }
    ], 'server')
  ]
})
export class AccountModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ProjectMiddleware)
      .forRoutes(AccountController);
  }
}
