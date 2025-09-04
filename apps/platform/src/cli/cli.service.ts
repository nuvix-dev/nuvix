import { Injectable } from '@nestjs/common';
import { AppConfigService } from '@nuvix/core';
import { Exception } from '@nuvix/core/extend/exception';
import * as fs from 'fs/promises';

@Injectable()
export class CliService {
  constructor(private readonly appConfig: AppConfigService) {}

  async getTemplate(name: string, vars?: Record<string, any>): Promise<string> {
    if (!name)
      throw new Exception(
        Exception.GENERAL_BAD_REQUEST,
        'Template name is required',
      );

    const path = this.appConfig.assetConfig.get(
      'assets',
      'dev',
      'templates',
      `${name}.template`,
    );

    if (!path)
      throw new Exception(
        Exception.GENERAL_NOT_FOUND,
        `Template '${name}' not found`,
      );

    let template = await fs.readFile(path, 'utf-8');

    if (vars) {
      for (const [key, value] of Object.entries(vars)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        template = template.replace(regex, value);
      }
    }

    return template;
  }
}
