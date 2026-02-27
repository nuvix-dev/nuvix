import * as fs from 'node:fs'
import { OnWorkerEvent, Processor } from '@nestjs/bullmq'
import { QueueFor } from '@nuvix/utils'
import { Job } from 'bullmq'
import Template from 'handlebars'
import { createTransport, Transporter } from 'nodemailer'
import type { SmtpConfig } from '../../config/smtp'
import { Queue } from './queue'
import { Logger } from '@nestjs/common'

@Processor(QueueFor.MAILS, { concurrency: 25 })
export class MailsQueue extends Queue {
  private readonly logger = new Logger(MailsQueue.name)
  private readonly transporter: Transporter
  private readonly templateCache = new Map<string, Template.TemplateDelegate>()

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
          ? { user: config.user, pass: config.password }
          : undefined,
      dkim:
        config.dkim.domain || config.dkim.key || config.dkim.privateKey
          ? {
              domainName: config.dkim.domain,
              keySelector: config.dkim.key,
              privateKey: config.dkim.privateKey,
            }
          : undefined,
      from: { name: config.sender, address: config.emailFrom },
      sender: { name: config.sender, address: config.emailFrom },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      logger: !appConfig.get('app').isProduction,
      tls: { rejectUnauthorized: false },
    } as any)
  }

  async process(job: Job<MailQueueOptions | MailsQueueOptions>) {
    if (job.name !== MailJob.SEND_EMAIL) return null

    const { body, subject, variables = {}, server } = job.data
    const config = this.appConfig.getSmtpConfig()

    if (!config.host && !server?.host) {
      throw new Error('SMTP configuration missing')
    }

    const emails = 'email' in job.data ? [job.data.email] : job.data.emails

    if (!emails?.length) {
      throw new Error('Missing recipient email')
    }

    const transporter = server?.host
      ? this.createTransport(server)
      : this.transporter

    const protocol = this.appConfig.get('app').forceHttps ? 'https' : 'http'
    const hostname = this.appConfig.get('app').domain

    const templateVariables = {
      ...variables,
      host: `${protocol}://${hostname}`,
      img_host: hostname,
      subject,
      year: new Date().getFullYear(),
    }

    const bodyTemplatePath =
      job.data.bodyTemplate ??
      this.appConfig.assetConfig.get('locale/templates/email-base-styled.tpl')

    const bodyTemplate = this.loadTemplate(bodyTemplatePath)
    const _body = Template.compile(body)(templateVariables)
    const renderedBody = bodyTemplate({
      body: _body,
      ...templateVariables,
    })

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

    return { status: 'success', recipients: emails.length }
  }

  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`)
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: any) {
    this.logger.error(
      `Job ${job.id} of type ${job.name} failed with error: ${err.message}`,
    )
  }

  private loadTemplate(path: string) {
    if (!this.templateCache.has(path)) {
      const source = fs.readFileSync(path, 'utf8')
      this.templateCache.set(path, Template.compile(source))
    }
    return this.templateCache.get(path)!
  }

  private async sendMail({
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
    await transporter.sendMail({
      from: transporter.options.from ?? transporter.options.sender,
      to: email,
      subject,
      html: body,
      text: this.convertHtmlToPlainText(body),
    })
  }

  private convertHtmlToPlainText(html: string) {
    return html
      .replace(/<\/p>/g, '\n\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g, '$2 ($1)')
      .replace(/<\/?[^>]+(>|$)/g, '')
  }

  private createTransport(options: SmtpConfig) {
    return createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth:
        options.username || options.password
          ? { user: options.username, pass: options.password }
          : undefined,
      from: { name: options.senderName, address: options.senderEmail },
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
