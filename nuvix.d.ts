import fastify from 'fastify';
import type {
  FastifyReply,
  FastifyRequest,
  RequestRouteOptions,
  SchemaCompiler,
} from 'fastify';
import type { Entities } from '@nuvix-tech/db';
import type { Entities as NuvixEntities } from '@nuvix/utils/types';

declare module 'fastify' {
  interface FastifyRequest {
    routeOptions: RequestRouteOptions<
      {
        hooks?: {
          [key: string]: { args: Array<any> };
        };
      },
      SchemaCompiler
    >;
    domainVerification: boolean;
    // Allow storing hooks arguments and other arbitrary properties
    hooks_args: Record<string, any>;
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
