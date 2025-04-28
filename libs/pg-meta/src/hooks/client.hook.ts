import { Hook } from '@nuvix/core/server';
import { FastifyRequest, FastifyReply } from 'fastify';

export class ResolveClient implements Hook {
  async preHandler(req: FastifyRequest, reply: FastifyReply) {
    // TODO: Implement logic to resolve the client
  }
}
