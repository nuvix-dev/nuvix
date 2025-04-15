import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { API_KEY } from '@nuvix/utils/constants';

export const ApiKey = createParamDecorator<any, any>(
  (data: unknown, ctx: ExecutionContext): any => {
    const request: Request = ctx.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-nuvix-api'];

    if (!apiKeyHeader) {
      return null;
    }

    const apiKeys = Array.isArray(apiKeyHeader)
      ? apiKeyHeader
      : apiKeyHeader.split(',');
    if (apiKeys.length === 0) {
      return null;
    }

    request[API_KEY] = apiKeys[0];
    return apiKeys[0];
  },
);
