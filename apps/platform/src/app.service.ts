import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Doc, ID, type Database } from '@nuvix-tech/db';
import { CoreService } from '@nuvix/core';
import { MailJob, type MailQueueOptions } from '@nuvix/core/resolvers/index.js';
import { QueueFor } from '@nuvix/utils';
import type { Queue } from 'bullmq';

@Injectable()
export class AppService {
  private readonly db: Database;
  constructor(
    private readonly coreService: CoreService,
    @InjectQueue(QueueFor.MAILS)
    private readonly mailsQueue: Queue<MailQueueOptions, unknown, MailJob>,
  ) {
    this.db = this.coreService.getPlatformDb();
  }

  async joinWaitlist(email: string, request: NuvixRequest) {
    await this.db.createDocument(
      'waitlist',
      new Doc({
        $id: ID.unique(),
        email,
        metadata: {
          userAgent: request.headers['user-agent'] || '',
          ip: request.ip || '',
          query: request.query || {},
        },
        notified: true,
      }),
    );

    await this.mailsQueue.add(MailJob.SEND_EMAIL, {
      email,
      subject: 'Welcome to the Waitlist',
      body: `<p>Thank you for joining the waitlist! We will notify you when we are ready to launch.</p>`,
      variables: {
        email,
      },
    });

    return {
      success: true,
      message: 'You have been added to the waitlist successfully.',
    };
  }
}
