import fs from 'fs/promises'
import path from 'path'
import Handlebars from 'handlebars'
import type { SmtpConfig } from '../config'
import { configuration } from '@nuvix/utils'
import { ProjectsDoc } from '@nuvix/utils/types'

export interface BuiltEmail {
  email: string
  subject: string
  body: string
  server?: SmtpConfig
  variables: Record<string, any>
}

export class EmailHelper {
  private templateCache = new Map<string, Function>()

  constructor() {}

  builder(project: ProjectsDoc) {
    return new EmailBuilder(this, project)
  }

  async render(templateFile: string, data: Record<string, any>) {
    const compiled = await this.getCompiledTemplate(templateFile)
    return compiled(data)
  }

  private async getCompiledTemplate(templateFile: string) {
    if (this.templateCache.has(templateFile)) {
      return this.templateCache.get(templateFile)!
    }

    const templatePath = path.join(configuration.assets.templates, templateFile)

    const source = await fs.readFile(templatePath, 'utf8')
    const compiled = Handlebars.compile(source)

    this.templateCache.set(templateFile, compiled)

    return compiled
  }

  /* ---------------------------------- */
  /* SMTP Resolution                    */
  /* ---------------------------------- */

  resolveSmtp(
    project: ProjectsDoc,
    customTemplate: any,
  ): SmtpConfig | undefined {
    const smtp = project.get('smtp', {}) as SmtpConfig
    const smtpEnabled = smtp.enabled ?? false

    if (!smtpEnabled) {
      return undefined
    }

    let senderEmail =
      configuration.smtp.emailFrom ?? configuration.app.emailTeam
    let senderName: string = configuration.app.name

    let replyTo = ''

    if (smtp.senderEmail) senderEmail = smtp.senderEmail
    if (smtp.senderName) senderName = smtp.senderName
    if (smtp.replyTo) replyTo = smtp.replyTo

    if (customTemplate?.senderEmail) senderEmail = customTemplate.senderEmail

    if (customTemplate?.senderName) senderName = customTemplate.senderName

    if (customTemplate?.replyTo) replyTo = customTemplate.replyTo

    return {
      host: smtp.host,
      port: smtp.port,
      username: smtp.username,
      password: smtp.password,
      secure: smtp.secure ?? false,
      senderEmail,
      senderName,
      replyTo,
    }
  }
}

class EmailBuilder {
  private userEmail!: string
  private templateFile!: string
  private templateKey!: string
  private subject!: string
  private templateData: Record<string, any> = {}
  private variables: Record<string, any> = {}

  constructor(
    private readonly helper: EmailHelper,
    private readonly project: ProjectsDoc,
  ) {}

  to(email: string) {
    this.userEmail = email
    return this
  }

  usingTemplate(file: string, key: string) {
    this.templateFile = file
    this.templateKey = key
    return this
  }

  withSubject(subject: string) {
    this.subject = subject
    return this
  }

  withData(data: Record<string, any>) {
    this.templateData = data
    return this
  }

  withVariables(vars: Record<string, any>) {
    this.variables = vars
    return this
  }

  async build(): Promise<BuiltEmail> {
    const customTemplate =
      this.project.get('templates', {})?.[`email.${this.templateKey}`] ?? null

    const rendered = await this.helper.render(
      this.templateFile,
      this.templateData,
    )

    const finalSubject = customTemplate?.subject ?? this.subject

    const finalBody = customTemplate?.message ?? rendered

    const smtpServer = this.helper.resolveSmtp(this.project, customTemplate)

    return Object.freeze({
      email: this.userEmail,
      subject: finalSubject,
      body: finalBody,
      server: smtpServer,
      variables: this.variables,
    })
  }
}
