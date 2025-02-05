import { Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import { Job } from 'bullmq';
import { createTransport } from 'nodemailer';
import {
  APP_SMTP_EMAIL_FROM,
  APP_SMTP_HOST,
  APP_SMTP_PASSWORD,
  APP_SMTP_PORT,
  APP_SMTP_SECURE,
  APP_SMTP_SENDER,
  APP_SMTP_USER,
} from 'src/Utils/constants';

@Processor('mails')
export class MailQueue extends Queue {
  private readonly transporter = createTransport({
    host: APP_SMTP_HOST,
    port: APP_SMTP_PORT,
    auth: {
      user: APP_SMTP_USER,
      pass: APP_SMTP_PASSWORD,
    },
    from: APP_SMTP_EMAIL_FROM,
    sender: APP_SMTP_SENDER,
    secure: APP_SMTP_SECURE,
    logger: true,
  });

  process(job: Job, token?: string): Promise<any> {
    return;
  }
}

export interface MailQueueOptions {}
