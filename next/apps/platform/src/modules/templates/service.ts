import { NotImplementedError } from '@nuvix/core/errors'
import type { Database } from '@nuvix/db'

export class TemplatesService {
  constructor(readonly db: Database) {}

  async getSmsTemplate(
    _projectId: string,
    _type: string,
    _locale: string,
  ): Promise<Record<string, unknown>> {
    throw new NotImplementedError('SMS templates not implemented', {
      code: 'not_implemented',
    })
  }

  async updateSmsTemplate(
    _projectId: string,
    _type: string,
    _locale: string,
    _input?: unknown,
  ): Promise<Record<string, unknown>> {
    throw new NotImplementedError('SMS templates not implemented', {
      code: 'not_implemented',
    })
  }

  async deleteSmsTemplate(_projectId: string, _type: string, _locale: string): Promise<void> {
    throw new NotImplementedError('SMS templates not implemented', {
      code: 'not_implemented',
    })
  }

  async getEmailTemplate(
    _projectId: string,
    _type: string,
    _locale: string,
  ): Promise<Record<string, unknown>> {
    throw new NotImplementedError('Email templates not implemented', {
      code: 'not_implemented',
    })
  }

  async updateEmailTemplate(
    _projectId: string,
    _type: string,
    _locale: string,
    _input?: unknown,
  ): Promise<Record<string, unknown>> {
    throw new NotImplementedError('Email templates not implemented', {
      code: 'not_implemented',
    })
  }

  async deleteEmailTemplate(_projectId: string, _type: string, _locale: string): Promise<void> {
    throw new NotImplementedError('Email templates not implemented', {
      code: 'not_implemented',
    })
  }
}
