import { Controller, Get, Query, Res } from '@nestjs/common';
import { AvatarsService } from './avatars.service';
import { ParseDuplicatePipe } from '@nuvix/core/pipes/duplicate.pipe';
import { FastifyReply } from 'fastify';

@Controller({ version: ['1'], path: 'avatars' })
export class AvatarsController {
  constructor(private readonly avatarsService: AvatarsService) {}

  @Get('initials')
  async generateAvatar(
    @Query('name', ParseDuplicatePipe) name: string = 'NA',
    @Query('width', ParseDuplicatePipe) width: string = '100',
    @Query('height', ParseDuplicatePipe) height: string = '100',
    @Query('background', ParseDuplicatePipe) background: string,
    @Query('circle', ParseDuplicatePipe) circle: boolean = false,
    @Res() res: FastifyReply,
  ) {
    return this.avatarsService.generateAvatar({
      name,
      width,
      height,
      background,
      circle,
      res,
    });
  }
}
