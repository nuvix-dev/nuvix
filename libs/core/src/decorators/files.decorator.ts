import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { Exception } from '../extend/exception';
import { MultipartValue } from '@fastify/multipart';
import { APP_STORAGE_TEMP } from '@nuvix/utils/constants';

export const UploadedFile = createParamDecorator(
  async (data: string = 'file', ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest<NuvixRequest>();

    const files = await request.saveRequestFiles({
      tmpdir: APP_STORAGE_TEMP,
    });
    const file = files.find(f => f.fieldname === data);
    if (!file) {
      throw new Exception(Exception.STORAGE_INVALID_FILE);
    }
    return file;
  },
);

export const MultipartParam = createParamDecorator(
  async (data: string, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest<NuvixRequest>();

    const param = (request.body as Record<string, unknown>)[
      data
    ] as MultipartValue;
    return param ? param.value : undefined;
  },
);
