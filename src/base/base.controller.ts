import { All, Controller, Res } from '@nestjs/common';
import { Response } from 'express';
import { Public } from 'src/Utils/decorator';

@Controller({ version: ['1'] })
export class BaseController {
  constructor() { }

  @All('health/version')
  @Public()
  healthVersion(@Res() res: Response): Response {
    return res.status(200).json({
      status: 'UP',
      version: '1.0.0',
    });
  }
}
