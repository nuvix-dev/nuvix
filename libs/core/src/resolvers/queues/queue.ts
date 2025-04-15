import { WorkerHost } from '@nestjs/bullmq';

export abstract class Queue extends WorkerHost {}
