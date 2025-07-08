import { Controller, Get, Redirect } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @Redirect('https://console.nuvix.in')
  main() { }

  @Get('favicon.ico')
  async getFavicon() {
    return this.appService.getFavicon();
  }
}
