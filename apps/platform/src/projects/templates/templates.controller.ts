import {
  Controller,
  Param,
  UseInterceptors,
  VERSION_NEUTRAL,
} from '@nestjs/common'
import { Exception } from '@nuvix/core/extend/exception'
import { ResponseInterceptor } from '@nuvix/core/resolvers'
import { ConsoleInterceptor } from '@nuvix/core/resolvers'
import { Auth, AuthType, Namespace } from '@nuvix/core/decorators'
import { TemplatesService } from './templates.service'
import { TemplateParamsDTO } from './DTO/params.dto'
import { Delete, Get, Patch } from '@nuvix/core'

@Namespace('projects')
@Controller({
  version: ['1', VERSION_NEUTRAL],
  path: 'projects/:projectId/templates',
})
@Auth(AuthType.ADMIN)
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get('sms/:type/:locale', {
    summary: 'Get custom SMS template',
    scopes: 'projects.read',
    sdk: {
      name: 'getSmsTemplate',
      descMd: '/docs/references/projects/get-sms-template.md',
    },
    docs: false,
  })
  async getSMSTemplate(
    @Param() { projectId, type, locale }: TemplateParamsDTO,
  ) {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED)
  }

  @Patch('sms/:type/:locale', {
    summary: 'Update custom SMS template',
    scopes: 'projects.update',
    sdk: {
      name: 'updateSmsTemplate',
      descMd: '/docs/references/projects/update-sms-template.md',
    },
    docs: false,
  })
  async updateSmsTemplate() {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED)
  }

  @Delete('sms/:type/:locale', {
    summary: 'Reset custom SMS template',
    scopes: 'projects.update',
    sdk: {
      name: 'deleteSmsTemplate',
      descMd: '/docs/references/projects/delete-sms-template.md',
    },
    docs: false,
  })
  async deleteSmsTemplate() {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED)
  }

  @Get('email/:type/:locale', {
    summary: 'Get custom email template',
    scopes: 'projects.read',
    sdk: {
      name: 'getEmailTemplate',
      descMd: '/docs/references/projects/get-email-template.md',
    },
    docs: false,
  })
  async getEmailTemplate(
    @Param() { projectId, type, locale }: TemplateParamsDTO,
  ) {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED)
  }

  @Patch('email/:type/:locale', {
    summary: 'Update custom email templates',
    scopes: 'projects.update',
    sdk: {
      name: 'updateEmailTemplate',
      descMd: '/docs/references/projects/update-email-template.md',
    },
    docs: false,
  })
  async updateEmailTemplate() {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED)
  }

  @Delete('email/:type/:locale', {
    summary: 'Delete custom email template',
    scopes: 'projects.update',
    sdk: {
      name: 'deleteEmailTemplate',
      descMd: '/docs/references/projects/delete-email-template.md',
    },
    docs: false,
  })
  async deleteEmailTemplate() {
    throw new Exception(Exception.GENERAL_NOT_IMPLEMENTED)
  }
}
