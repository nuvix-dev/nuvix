import { Controller, Get, Redirect } from '@nestjs/common';
import { AppService } from './app.service';
import { configuration } from '@nuvix/utils';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Redirect(configuration.app.consoleURL)
  main() {}

  @Get('favicon.ico')
  async getFavicon() {
    return this.appService.getFavicon();
  }
}
