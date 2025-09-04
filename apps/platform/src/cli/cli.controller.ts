import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CliService } from './cli.service';

@Controller({ path: 'cli', version: ['1'] })
export class CliController {
  constructor(private readonly cliService: CliService) {}

  @Post('template')
  getTemplate(
    @Query('name') name: string,
    @Body('vars') vars?: Record<string, any>,
  ) {
    return this.cliService.getTemplate(name, vars);
  }
}
