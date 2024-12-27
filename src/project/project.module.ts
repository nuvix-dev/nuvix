import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Project, ProjectSchema } from './schemas/project.schema';
import { Organization, OrganizationSchema } from 'src/user/schemas/user.schema';

@Module({
  controllers: [ProjectController],
  providers: [ProjectService],
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Organization.name, schema: OrganizationSchema }
    ], 'server')
  ]
})
export class ProjectModule { }
