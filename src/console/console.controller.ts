import { Controller, Get, Res } from '@nestjs/common';
import { ConsoleService } from './console.service';

@Controller('console')
export class ConsoleController {
  constructor(private readonly consoleService: ConsoleService) { }

  @Get('variables')
  async getVariables(@Res() res) {
    return res.json({
      "_APP_DOMAIN_TARGET": "nuvix-console.vercel.app",
      "_APP_STORAGE_LIMIT": 5368709120,
      "_APP_FUNCTIONS_SIZE_LIMIT": 30000000,
      "_APP_USAGE_STATS": "enabled",
      "_APP_VCS_ENABLED": true,
      "_APP_DOMAIN_ENABLED": true,
      "_APP_ASSISTANT_ENABLED": false
    }).status(200);
  }
}
