import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Exception } from '../extend/exception';

export const UploadedFile = createParamDecorator(
  async (data: unknown, ctx: ExecutionContext) => {
    const request: FastifyRequest = ctx
      .switchToHttp()
      .getRequest<FastifyRequest>();

    const file = await request.file();

    if (!file) {
      throw new Exception(Exception.STORAGE_INVALID_FILE);
    }

    return file;
  },
);
