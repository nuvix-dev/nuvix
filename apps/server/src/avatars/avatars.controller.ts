import {
  Controller,
  Param,
  Query,
  Res,
  StreamableFile,
  UseInterceptors,
} from '@nestjs/common'
import { Get } from '@nuvix/core'
import { Namespace, Scope } from '@nuvix/core/decorators'
import { ParseDuplicatePipe } from '@nuvix/core/pipes'
import { ApiInterceptor } from '@nuvix/core/resolvers'
import { AvatarsService } from './avatars.service'
import {
  CodesQuerDTO,
  CreditCardParamDTO,
  FaviconQueryDTO,
  InitialsQueryDTO,
  QrQueryDTO,
} from './DTO/misc.dto'

@Controller({ version: ['1'], path: 'avatars' })
@Namespace('avatars')
@UseInterceptors(ApiInterceptor)
@Scope('avatars.read')
export class AvatarsController {
  constructor(private readonly avatarsService: AvatarsService) {}

  @Get('credit-cards/:code', {
    summary: 'Get credit card image',
    description:
      'Returns the image of a credit card based on the provided code',
  })
  async getCreditCard(
    @Param() { code }: CreditCardParamDTO,
    @Query() query: CodesQuerDTO,
    @Res({ passthrough: true }) res: NuvixRes,
  ): Promise<StreamableFile> {
    return this.avatarsService.getCreditCard({ code, res, ...query })
  }

  @Get('browsers/:code', {
    summary: 'Get browser image',
    description: 'Returns the image of a browser based on the provided code',
  })
  async getBrowser(
    @Param('code', ParseDuplicatePipe) code: string,
    @Query() query: CodesQuerDTO,
    @Res({ passthrough: true }) res: NuvixRes,
  ): Promise<StreamableFile> {
    return this.avatarsService.getBrowser({ code, res, ...query })
  }

  @Get('flags/:code', {
    summary: 'Get country flag image',
    description:
      'Returns the image of a country flag based on the provided code',
  })
  async getFlag(
    @Param('code', ParseDuplicatePipe) code: string,
    @Query() query: CodesQuerDTO,
    @Res({ passthrough: true }) res: NuvixRes,
  ): Promise<StreamableFile> {
    return this.avatarsService.getFlag({ code, res, ...query })
  }

  @Get('initials', {
    summary: 'Generate avatar with initials',
    description:
      'Generates an avatar image with user initials based on the provided name and customization options',
  })
  async generateAvatar(
    @Query() query: InitialsQueryDTO,
    @Res({ passthrough: true }) res: NuvixRes,
  ): Promise<StreamableFile> {
    return this.avatarsService.generateAvatar({
      ...query,
      res,
    })
  }

  @Get('favicon', {
    summary: 'Get favicon image',
    description: 'Returns the favicon image for a given URL',
  })
  async getFavicon(
    @Query() { url }: FaviconQueryDTO,
    @Res({ passthrough: true }) res: NuvixRes,
  ): Promise<StreamableFile> {
    return this.avatarsService.getFavicon({ url, res })
  }
}
