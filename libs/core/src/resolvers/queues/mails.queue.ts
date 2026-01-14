import { OnWorkerEvent, Processor } from '@nestjs/bullmq'
import { Queue } from './queue'
import { Job } from 'bullmq'
import { createTransport, Transporter } from 'nodemailer'
import { QueueFor } from '@nuvix/utils'
import { Exception } from '../../extend/exception'
import * as fs from 'fs'
import { Logger } from '@nestjs/common'
import * as Template from 'handlebars'
import { AppConfigService } from '../../config.service.js'
import type { SmtpConfig } from '../../config/smtp.js'

@Processor(QueueFor.MAILS, { concurrency: 10000 })
export class MailsQueue extends Queue {
  private readonly logger = new Logger(MailsQueue.name)
  private readonly transporter: Transporter

  constructor(private readonly appConfig: AppConfigService) {
    super()
    const config = this.appConfig.getSmtpConfig()

    this.transporter = createTransport({
      host: config.host,
      pool: true,
      port: config.port,
      secure: config.secure,
      auth:
        config.user || config.password
          ? {
              user: config.user,
              pass: config.password,
            }
          : undefined,
      dkim:
        config.dkim.domain || config.dkim.key || config.dkim.privateKey
          ? {
              domainName: config.dkim.domain,
              keySelector: config.dkim.key,
              privateKey: config.dkim.privateKey,
            }
          : undefined,
      from: {
        name: config.sender,
        address: config.emailFrom,
      },
      sender: {
        name: config.sender,
        address: config.emailFrom,
      },
      logger: true,
      tls: {
        rejectUnauthorized: false,
      },
    } as any)
  }

  // TODO: Add retry logic with exponential backoff for failed email sends
  // improve logging to capture more details about failures
  // and reduce the boilerplate code for rendering templates
  async process(
    job: Job<MailQueueOptions | MailsQueueOptions, any, MailJob>,
  ): Promise<any> {
    switch (job.name) {
      case MailJob.SEND_EMAIL:
        const { body, subject, server, variables } = job.data
        const config = this.appConfig.getSmtpConfig()

        if (!config.host && !server?.host)
          throw Error(
            'Skipped mail processing. No SMTP configuration has been set.',
          )

        const emails = (job.data as MailQueueOptions).email
          ? [(job.data as MailQueueOptions).email]
          : (job.data as MailsQueueOptions).emails

        if (!emails || !emails.length)
          throw new Exception(
            Exception.GENERAL_SERVER_ERROR,
            'Missing recipient email',
          )

        let transporter = this.transporter

        if (server && server.host) {
          transporter = this.createTransport(server)
        }

        const protocol = this.appConfig.get('app').forceHttps ? 'https' : 'http'
        const hostname = this.appConfig.get('app').domain
        const templateVariables = {
          ...variables,
          host: `${protocol}://${hostname}`,
          img_host: hostname,
          subject,
          year: new Date().getFullYear(),
        }

        if (!job.data.bodyTemplate) {
          job.data.bodyTemplate = this.appConfig.assetConfig.get(
            'assets/locale/templates/email-base-styled.tpl',
          )
        }

        const templateSource = fs.readFileSync(job.data.bodyTemplate, 'utf8')
        const bodyTemplate = Template.compile(templateSource)
        const renderedBody = bodyTemplate({ body, ...templateVariables })

        const subjectTemplate = Template.compile(subject)
        const renderedSubject = subjectTemplate(templateVariables)

        for (const email of emails) {
          await this.sendMail({
            transporter,
            email,
            subject: renderedSubject,
            body: renderedBody,
          })
        }
        return {
          status: 'success',
          message: `Email sent to ${emails.length} recipients with subject "${renderedSubject}"`,
        }
      default:
        return null
    }
  }

  async sendMail({
    transporter,
    email,
    subject,
    body,
  }: {
    transporter: Transporter
    email: string
    subject: string
    body: string
  }) {
    const mailOptions = {
      from: transporter.options.from ?? transporter.options.sender,
      to: email,
      subject,
      html: body,
      text: this.convertHtmlToPlainText(body), // Strip HTML tags for plain text version
    }

    try {
      await transporter.sendMail(mailOptions)
    } catch (error: any) {
      throw new Error(`Error sending mail: ${error.message}`)
    }
  }

  convertHtmlToPlainText = (html: string) => {
    return html
      .replace(/<\/p>/g, '\n\n') // Convert paragraphs to double line breaks
      .replace(/<br\s*\/?>/g, '\n') // Convert <br> to new lines
      .replace(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g, '$2 ($1)') // Keep links
      .replace(/<\/?[^>]+(>|$)/g, '') // Remove other HTML tags
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.verbose(
      `Processing job ${job.id} of type ${job.name} with data ${JSON.stringify(job.data)}...`,
    )
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: any) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed with error: ${err.message}`,
    )
  }

  createTransport(options: SmtpConfig) {
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
    } as any)
  }
}

interface Variables {
  [key: string]: string | number | boolean
}

export interface MailQueueOptions {
  email: string
  subject: string
  body: string
  variables?: Variables
  server?: SmtpConfig
  bodyTemplate?: string
}

export interface MailsQueueOptions extends Omit<MailQueueOptions, 'email'> {
  emails: string[]
}

export enum MailJob {
  SEND_EMAIL = 'send_email',
}
