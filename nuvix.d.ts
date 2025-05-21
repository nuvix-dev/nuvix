declare global {
    export type NuvixRequest = import('fastify').FastifyRequest;
    export type NuvixRes = import('fastify').FastifyReply;
    interface ImportMeta {
        readonly env: ImportMetaEnv
    }
}

interface ImportMetaEnv {
    [key: string]: string;
}

export { };