import { All, Controller, Res } from '@nestjs/common';

@Controller()
export class BaseController {
  constructor() { }

  @All('health/version')
  healthVersion(@Res() res): string {
    return res.status(200).json({
      status: 'UP',
      version: '1.0.0',
    });
  }
}
