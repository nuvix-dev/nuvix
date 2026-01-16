import { Controller, Get, UseInterceptors } from '@nestjs/common'
import { AppService } from './app.service'
import { Public } from '@nuvix/core/resolvers'
import { ResponseInterceptor } from '@nuvix/core/resolvers'

@Controller()
@UseInterceptors(ResponseInterceptor)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  main() {
    return {
      version: '1.0.0',
      status: 'ok',
    }
  }
}
