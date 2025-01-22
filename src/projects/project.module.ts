import { Module } from '@nestjs/common';
import { ProjectService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Project, ProjectSchema } from './schemas/project.schema';
import {
  Organization,
  OrganizationSchema,
} from 'src/console-user/schemas/organization.schema';
import { Platform, PlatformSchema } from './schemas/platform.schema';
import { Key, KeySchema } from './schemas/key.schema';
import { Webhook, WebhookSchema } from './schemas/webhook.schema';
import { JwtAuthGuard } from 'src/console-account/jwt-auth.guard';
import { GlobalMongooseModule } from 'src/core/resolver/mongoose.resolver';
import { JwtModule } from '@nestjs/jwt';
import { JWT_SECRET } from 'src/Utils/constants';
import { ProjectController } from './project.controller';

@Module({
  controllers: [ProjectsController, ProjectController],
  providers: [ProjectService, JwtAuthGuard],
  imports: [
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
    GlobalMongooseModule.forFeature(
      [
        { name: Project.name, schema: ProjectSchema },
        { name: Organization.name, schema: OrganizationSchema },
        { name: Platform.name, schema: PlatformSchema },
        { name: Key.name, schema: KeySchema },
        { name: Webhook.name, schema: WebhookSchema },
      ],
      'server',
    ),
  ],
})
export class ProjectModule {}
