import { Controller, Get, Redirect } from '@nestjs/common'
import { configuration } from '@nuvix/utils'
import { AppService } from './app.service'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Redirect(configuration.app.consoleURL)
  main() {}

  @Get('favicon.ico')
  async getFavicon() {
    return this.appService.getFavicon()
  }
}
