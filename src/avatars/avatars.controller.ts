import { Controller, Get, Query, Res } from '@nestjs/common';
import { AvatarsService } from './avatars.service';
import { Response } from 'express';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import { Exception } from 'src/core/extend/exception';
import { PYTHON_API_URL } from 'src/Utils/constants';

@Controller()
export class AvatarsController {
  constructor(
    private readonly avatarsService: AvatarsService,
    private httpService: HttpService
  ) { }

  @Get('initials')
  async generateAvatar(
    @Query('name') name: string = 'NA',
    @Query('width') width: number = 100,
    @Query('height') height: number = 100,
    @Query('background') background: string = '#3498db',
    @Res() res: Response
  ) {
    try {
      const url = PYTHON_API_URL + `/avatar/generate?name=${name}&width=${width}&height=${height}&background=${background}`;
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(url, { responseType: 'arraybuffer' })
      );

      res.set('Content-Type', 'image/png');
      res.send(Buffer.from(response.data));
    } catch (error) {
      console.error('Error fetching image:', error);
      throw new Exception(Exception.GENERAL_SERVER_ERROR);
    }
  }
}
