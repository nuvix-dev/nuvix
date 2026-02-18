import { Controller, Get, Query, Redirect, Render } from '@nestjs/common'
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

  @Get('health')
  health() {
    return {
      status: 'ok',
    }
  }

  @Get('auth/oauth2/success')
  @Render('oauth/success.hbs')
  renderOAuth2Success(@Query('error') error?: string) {
    return {
      status: 'ok',
      error,
    }
  }

  @Get('auth/oauth2/failure')
  @Render('oauth/failure.hbs')
  renderOAuth2Failure(@Query('error') error?: string) {
    let errorObj = {
      message: 'An unknown error occurred.',
    }

    if (error) {
      try {
        errorObj = JSON.parse(error)
      } catch (e) {
        errorObj = { message: error }
      }
    }

    return {
      status: 'error',
      error: errorObj,
    }
  }
}
