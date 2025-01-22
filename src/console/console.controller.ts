import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ConsoleService } from './console.service';

@Controller({ version: ['1'], path: 'console' })
export class ConsoleController {
  constructor(private readonly consoleService: ConsoleService) {}

  @Get('variables')
  async getVariables(@Res() res) {
    return res
      .json({
        _APP_DOMAIN_TARGET: 'nuvix-console.vercel.app',
        _APP_STORAGE_LIMIT: 5368709120,
        _APP_FUNCTIONS_SIZE_LIMIT: 30000000,
        _APP_USAGE_STATS: 'enabled',
        _APP_VCS_ENABLED: true,
        _APP_DOMAIN_ENABLED: true,
        _APP_ASSISTANT_ENABLED: true,
      })
      .status(200);
  }

  @Get('plans')
  async getPlans() {
    let plans = await this.consoleService.getPlans();
    return {
      total: plans.length,
      plans: plans,
    };
  }

  @Post('plans')
  async createPlan() {
    return await this.consoleService.createPlan();
  }

  @Get('regions')
  async getRegions(@Res() res) {
    return res
      .json({
        total: 10,
        regions: [
          {
            $id: 'default',
            name: 'Frankfurt',
            disabled: false,
            default: true,
            flag: 'de',
          },
          {
            $id: 'fra',
            name: 'Frankfurt',
            disabled: false,
            default: true,
            flag: 'de',
          },
          {
            $id: 'nyc',
            name: 'New York',
            disabled: true,
            default: true,
            flag: 'us',
          },
          {
            $id: 'sfo',
            name: 'San Francisco',
            disabled: true,
            default: true,
            flag: 'us',
          },
          {
            $id: 'blr',
            name: 'Banglore',
            disabled: true,
            default: true,
            flag: 'in',
          },
          {
            $id: 'lon',
            name: 'London',
            disabled: true,
            default: true,
            flag: 'gb',
          },
          {
            $id: 'ams',
            name: 'Amsterdam',
            disabled: true,
            default: true,
            flag: 'nl',
          },
          {
            $id: 'sgp',
            name: 'Singapore',
            disabled: true,
            default: true,
            flag: 'sg',
          },
          {
            $id: 'tor',
            name: 'Toronto',
            disabled: true,
            default: true,
            flag: 'ca',
          },
          {
            $id: 'syd',
            name: 'Sydney',
            disabled: true,
            default: true,
            flag: 'au',
          },
        ],
      })
      .status(200);
  }

  @Post('sources')
  async getSources(@Res() res, @Body() input) {
    return res.json({}).status(200);
  }

  @Get('one')
  async getONE() {
    return await this.consoleService.applyONE();
  }
}
