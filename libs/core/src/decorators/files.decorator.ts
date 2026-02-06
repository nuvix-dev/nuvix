import { MultipartValue } from '@fastify/multipart'
import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { configuration } from '@nuvix/utils'
import { Exception } from '../extend/exception'

export const UploadedFile = createParamDecorator(
  async (data, ctx: ExecutionContext) => {
    const fieldname = data ?? 'file'
    const request: NuvixRequest = ctx.switchToHttp().getRequest<NuvixRequest>()

    const files = await request.saveRequestFiles({
      tmpdir: configuration.storage.temp,
    })
    const file = files.find(f => f.fieldname === fieldname)
    if (!file) {
      throw new Exception(Exception.STORAGE_INVALID_FILE)
    }
    return file
  },
)

export const MultipartParam = createParamDecorator(
  async (data: string, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest<NuvixRequest>()

    const param = (request.body as Record<string, unknown>)[
      data
    ] as MultipartValue
    return param ? param.value : undefined
  },
)
