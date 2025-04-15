import { Module } from '@nestjs/common';
import { ProjectService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { JwtModule } from '@nestjs/jwt';
import { JWT_SECRET } from '@nuvix/utils/constants';
import { ProjectController } from './project.controller';
import { BullModule } from '@nestjs/bullmq';
import { ProjectQueue } from '@nuvix/core/resolvers/queues/project.queue';

@Module({
  controllers: [ProjectsController, ProjectController],
  providers: [ProjectService, ProjectQueue],
  imports: [
    JwtModule.register({
      secret: JWT_SECRET,
      signOptions: { expiresIn: '15m' },
    }),
    BullModule.registerQueue({
      name: 'projects',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    }),
  ],
})
export class ProjectModule {}
