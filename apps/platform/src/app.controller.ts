import { Controller, Get, UseInterceptors } from '@nestjs/common'
import { ResponseInterceptor } from '@nuvix/core/resolvers'
import { AppService } from './app.service'

@Controller()
@UseInterceptors(ResponseInterceptor)
export class AppController {
  constructor(readonly _appService: AppService) {}

  @Get()
  main() {
    return {
      version: '1.0.0',
      status: 'ok',
    }
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
    }
  }
}
