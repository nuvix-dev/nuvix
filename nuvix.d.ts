import fastify from 'fastify';
import type {
  FastifyReply,
  FastifyRequest,
  RequestRouteOptions,
  SchemaCompiler,
  FastifyContextConfig,
  FastifyRouteConfig,
} from 'fastify';
import type { Entities } from '@nuvix-tech/db';
import type { Entities as NuvixEntities } from '@nuvix/utils/types';
import type { RouteContext, ThrottleOptions } from '@nuvix/utils';
import type { AuditEventType } from '@nuvix/core/decorators';

declare module 'fastify' {
  interface FastifyContextConfig {
    [RouteContext.AUDIT]?: AuditEventType;
    [RouteContext.RATE_LIMIT]?: ThrottleOptions;
    [RouteContext.SKIP_LOGGING]?: boolean;
  }

  interface FastifyRouteConfig {

  }

  interface FastifyRequest {
    routeOptions: RequestRouteOptions<
      {
        hooks?: {
          [key: string]: { args: Array<any>; };
        };
      },
      SchemaCompiler
    >;
    domainVerification: boolean;
    // Allow storing hooks arguments and other arbitrary properties
    hooks_args: Record<string, any>;
    rate_limit?: {
      limit: number;
      remaining: number;
      reset: number; // timestamp
    }
    // Index signature to allow bracket notation access with string keys
    [key: string | symbol]: any;
  }
}

declare global {
  export type NuvixRequest = FastifyRequest;
  export type NuvixRes = FastifyReply;
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

declare module '@nuvix-tech/db' {
  export interface Entities extends NuvixEntities {}
}

interface ImportMetaEnv {
  [key: string]: string;
}

export {};
