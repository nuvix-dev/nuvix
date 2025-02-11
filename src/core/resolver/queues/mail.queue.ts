import { OnWorkerEvent, Processor } from '@nestjs/bullmq';
import { Queue } from './queue';
import { Job } from 'bullmq';
import { createTransport, Transporter } from 'nodemailer';
import {
  APP_SMTP_EMAIL_FROM,
  APP_SMTP_HOST,
  APP_SMTP_PASSWORD,
  APP_SMTP_PORT,
  APP_SMTP_SECURE,
  APP_SMTP_SENDER,
  APP_SMTP_USER,
  SEND_TYPE_EMAIL,
} from 'src/Utils/constants';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { Exception } from 'src/core/extend/exception';
import * as fs from 'fs';
import { Logger } from '@nestjs/common';
import path from 'path';
import * as Template from 'handlebars';

@Processor('mails')
export class MailQueue extends Queue {
  private readonly logger = new Logger(MailQueue.name);
  private readonly transporter = createTransport({
    host: APP_SMTP_HOST,
    port: APP_SMTP_PORT,
    secure: APP_SMTP_SECURE,
    auth:
      APP_SMTP_USER || APP_SMTP_PASSWORD
        ? {
            user: APP_SMTP_USER,
            pass: APP_SMTP_PASSWORD,
          }
        : undefined,
    from: {
      name: APP_SMTP_SENDER,
      address: APP_SMTP_EMAIL_FROM,
    },
    sender: {
      name: APP_SMTP_SENDER,
      address: APP_SMTP_EMAIL_FROM,
    },
    logger: true,
    tls: {
      rejectUnauthorized: false,
    },
  });

  async process(
    job: Job<MailQueueOptions | MailsQueueOptions, any, MailJobs>,
    token?: string,
  ): Promise<any> {
    switch (job.name) {
      case SEND_TYPE_EMAIL:
        const { body, subject, server, variables } = job.data;

        if (!APP_SMTP_HOST && !server?.host)
          throw Error(
            'Skipped mail processing. No SMTP configuration has been set.',
          );

        const emails = (job.data as MailQueueOptions).email
          ? [(job.data as MailQueueOptions).email]
          : (job.data as MailsQueueOptions).emails;

        if (!emails || !emails.length)
          throw new Exception(
            Exception.GENERAL_SERVER_ERROR,
            'Missing recipient email',
          );

        let transporter = this.transporter;

        if (server && server.host) {
          transporter = this.createTransport(server);
        }

        const protocol =
          process.env._APP_OPTIONS_FORCE_HTTPS === 'disabled'
            ? 'http'
            : 'https';
        const hostname = process.env._APP_DOMAIN;
        const templateVariables = {
          ...variables,
          host: `${protocol}://${hostname}`,
          subject,
          year: new Date().getFullYear(),
        };

        if (!job.data.bodyTemplate) {
          job.data.bodyTemplate = path.resolve(
            __dirname,
            '../../../../src/core/config/locale/templates/email-base.tpl',
          );
        }

        const templateSource = fs.readFileSync(job.data.bodyTemplate, 'utf8');
        const bodyTemplate = Template.compile(templateSource);
        const renderedBody = bodyTemplate({ body, ...templateVariables });

        const subjectTemplate = Template.compile(subject);
        const renderedSubject = subjectTemplate(templateVariables);

        for (const email of emails) {
          await this.sendMail({
            transporter,
            email,
            subject: renderedSubject,
            body: renderedBody,
          });
        }
        break;
      default:
        return null;
    }
  }

  async sendMail({
    transporter,
    email,
    subject,
    body,
  }: {
    transporter: Transporter<
      SMTPTransport.SentMessageInfo,
      SMTPTransport.Options
    >;
    email: string;
    subject: string;
    body: string;
  }) {
    const mailOptions = {
      to: email,
      subject,
      html: body,
      text: body.replace(/<[^>]+>/g, ''), // Strip HTML tags for plain text version
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      throw new Error(`Error sending mail: ${error.message}`);
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.verbose(
      `Processing job ${job.id} of type ${job.name} with data ${JSON.stringify(job.data)}...`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: any) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed with error: ${err.message}`,
    );
  }

  createTransport(options: ServerOptions) {
    return createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth:
        options.username || options.password
          ? {
              user: options.username,
              pass: options.password,
            }
          : undefined,
      replyTo: options.replyTo,
      sender: {
        name: options.senderName,
        address: options.senderEmail,
      },
      from: {
        name: options.senderName,
        address: options.senderEmail,
      },
    });
  }
}

interface ServerOptions {
  host?: string | null;
  port?: number | null;
  username?: string | null;
  password?: string | null;
  secure?: boolean;
  replyTo?: string;
  senderEmail?: string;
  senderName?: string;
}

interface Variables {
  [key: string]: string | number | boolean;
}

export interface MailQueueOptions {
  email: string;
  subject: string;
  body: string;
  variables?: Variables;
  server?: ServerOptions;
  bodyTemplate?: string;
}

export interface MailsQueueOptions extends Omit<MailQueueOptions, 'email'> {
  emails: string[];
}

export type MailJobs = 'sendEmail';
