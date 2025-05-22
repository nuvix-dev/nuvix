import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConsoleService } from './console.service';
import { AuthGuard, Public } from '@nuvix/core/resolvers/guards/auth.guard';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';
import { Models } from '@nuvix/core/helper/response.helper';
import { ConsoleInterceptor } from '@nuvix/core/resolvers/interceptors/console.interceptor';
import { ResModel } from '@nuvix/core/decorators';

@Controller()
@UseGuards(AuthGuard)
@UseInterceptors(ResponseInterceptor, ConsoleInterceptor)
export class ConsoleController {
  constructor(private readonly consoleService: ConsoleService) {}

  @Get()
  @Public()
  getMain() {
    return {
      message: 'Welcome to Nuvix Console API!',
      version: '1.0.0',
      status: 'ok',
      uptime: process.uptime(),
      date: new Date(),
    };
  }

  @Public()
  @Get('variables')
  async getVariables() {
    return {
      _APP_DOMAIN_TARGET: 'nuvix.in',
      _APP_STORAGE_LIMIT: 5368709120,
      _APP_FUNCTIONS_SIZE_LIMIT: 30000000,
      _APP_USAGE_STATS: 'disabled',
      _APP_VCS_ENABLED: false,
      _APP_DOMAIN_ENABLED: true,
      _APP_ASSISTANT_ENABLED: true,
    };
  }

  @Public()
  @Get('plans')
  @ResModel({ type: Models.BILLING_PLAN, list: true })
  async getPlans() {
    const plans = await this.consoleService.getPlans();
    return {
      total: plans.length,
      plans: plans,
    };
  }

  @Public()
  @Post('plans')
  @ResModel(Models.BILLING_PLAN)
  async createPlan() {
    return await this.consoleService.createPlan();
  }

  @Public()
  @Get('regions')
  async getRegions() {
    return {
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
    };
  }

  @Public()
  @Post('sources')
  async getSources(@Body() input) {
    return {};
  }

  @Get('init')
  @Public()
  async init() {
    return await this.consoleService.initConsole();
  }

  @Get('reset')
  @Public()
  async reset() {
    return await this.consoleService.resetConsole();
  }
}
