import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AppService } from './app.service';
import { AuthGuard, Public } from '@nuvix/core/resolvers/guards/auth.guard';
import { ResponseInterceptor } from '@nuvix/core/resolvers/interceptors/response.interceptor';

@Controller()
@UseGuards(AuthGuard)
@UseInterceptors(ResponseInterceptor)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  main() {
    return {
      version: '1.0.0',
      status: 'ok',
    };
  }

  @Post('join-waitlist')
  @Public()
  async joinWaitlist(
    @Body('email') email: string,
    @Req() request: NuvixRequest,
  ) {
    return this.appService.joinWaitlist(email, request);
  }
}
