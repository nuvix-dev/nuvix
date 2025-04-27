import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { API_KEY } from '@nuvix/utils/constants';
import { FastifyReply } from 'fastify';

export const ApiKey = createParamDecorator<any, any>(
  (data: unknown, ctx: ExecutionContext): any => {
    const request: FastifyReply = ctx.switchToHttp().getRequest();
    const apiKeyHeader = request.getHeader('x-nuvix-api') as string;

    if (!apiKeyHeader) {
      return null;
    }

    const apiKeys = Array.isArray(apiKeyHeader)
      ? apiKeyHeader
      : apiKeyHeader.split(',');
    if (apiKeys.length === 0) {
      return null;
    }

    (request as any)[API_KEY] = apiKeys[0];
    return apiKeys[0];
  },
);
