import { applyDecorators, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '../resolvers/guards';
import { RouteConfig } from '@nestjs/platform-fastify';
import { RouteContext, type ThrottleOptions } from '@nuvix/utils';

export const Throttle = (options: ThrottleOptions) => {
  return applyDecorators(
    UseGuards(ThrottlerGuard),
    RouteConfig({
      [RouteContext.RATE_LIMIT]: options,
    }),
  );
};
