import fastify from 'fastify';
import type { FastifyReply, FastifyRequest, RequestRouteOptions, SchemaCompiler } from 'fastify';

declare module 'fastify' {
    interface FastifyRequest {
        routeOptions: RequestRouteOptions<{
            hooks?: {
                [key: string]: { args: Array<any> }
            }
        }, SchemaCompiler>;
    }
}

declare global {
    export type NuvixRequest = FastifyRequest;
    export type NuvixRes = FastifyReply;
    interface ImportMeta {
        readonly env: ImportMetaEnv
    }
}

interface ImportMetaEnv {
    [key: string]: string;
}

export { };
