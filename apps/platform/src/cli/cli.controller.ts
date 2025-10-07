import { Body, Controller, Post, Query, VERSION_NEUTRAL } from '@nestjs/common'
import { CliService } from './cli.service'

@Controller({ path: 'cli', version: ['1', VERSION_NEUTRAL] })
export class CliController {
  constructor(private readonly cliService: CliService) {}

  @Post('template')
  getTemplate(
    @Query('name') name: string,
    @Body('vars') vars?: Record<string, any>,
  ) {
    return this.cliService.getTemplate(name, vars)
  }
}
