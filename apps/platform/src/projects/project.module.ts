import { Module } from '@nestjs/common';
import { ProjectService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { JwtModule } from '@nestjs/jwt';
import { JWT_SECRET, QueueFor } from '@nuvix/utils';
import { ProjectController } from './project.controller';
import { BullModule } from '@nestjs/bullmq';
import { ProjectsQueue } from '@nuvix/core/resolvers/queues/projects.queue';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule,
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
    BullModule.registerQueue({
      name: QueueFor.PROJECTS,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 1,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
  ],
  providers: [ProjectService, ProjectsQueue],
  controllers: [ProjectsController, ProjectController],
})
export class ProjectModule {}
