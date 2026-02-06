import { Controller, Get, UseInterceptors } from '@nestjs/common'
import { Public, ResponseInterceptor } from '@nuvix/core/resolvers'
import { AppService } from './app.service'

@Controller()
@UseInterceptors(ResponseInterceptor)
export class AppController {
  constructor(readonly _appService: AppService) {}

  @Get()
  @Public()
  main() {
    return {
      version: '1.0.0',
      status: 'ok',
    }
  }
}
