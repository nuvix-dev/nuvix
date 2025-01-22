import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { connectionFactory } from 'src/core/db.provider';
import { GlobalMongooseModule } from 'src/core/resolver/mongoose.resolver';
import { Project, ProjectSchema } from 'src/projects/schemas/project.schema';
import { ProjectMiddleware } from 'src/core/resolver/middlewares/project.middleware';
import { JwtModule } from '@nestjs/jwt';
import { JWT_SECRET } from 'src/Utils/constants';

@Module({
  controllers: [UsersController],
  providers: [UsersService, connectionFactory],
  imports: [
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
    GlobalMongooseModule.forFeature(
      [{ name: Project.name, schema: ProjectSchema }],
      'server',
    ),
  ],
})
export class UsersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ProjectMiddleware).forRoutes(UsersController);
  }
}
