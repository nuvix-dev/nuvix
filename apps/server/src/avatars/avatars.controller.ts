import { Controller, Query, Res, UseInterceptors } from '@nestjs/common'
import { AvatarsService } from './avatars.service'
import { ParseDuplicatePipe } from '@nuvix/core/pipes/duplicate.pipe'
import { Get } from '@nuvix/core'
import { Namespace, Scope } from '@nuvix/core/decorators'
import { ApiInterceptor } from '@nuvix/core/resolvers'

@Controller({ version: ['1'], path: 'avatars' })
@Namespace('avatars')
// @UseInterceptors(ApiInterceptor)
@Scope('avatars.read')
export class AvatarsController {
  constructor(private readonly avatarsService: AvatarsService) {}

  @Get('initials', {
    summary: 'Generate avatar with initials',
    description:
      'Generates an avatar image with user initials based on the provided name and customization options',
  })
  async generateAvatar(
    @Query('name', ParseDuplicatePipe) name: string = 'NA',
    @Query('width', ParseDuplicatePipe) width: string = '100',
    @Query('height', ParseDuplicatePipe) height: string = '100',
    @Query('background', ParseDuplicatePipe) background: string,
    @Query('circle', ParseDuplicatePipe) circle: boolean = false,
    @Res() res: NuvixRes,
  ) {
    return this.avatarsService.generateAvatar({
      name,
      width,
      height,
      background,
      circle,
      res,
    })
  }
}
