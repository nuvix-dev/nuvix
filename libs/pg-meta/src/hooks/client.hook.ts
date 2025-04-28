import { Injectable } from '@nestjs/common';
import { Hook } from '@nuvix/core/server';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class ResolveClient implements Hook {
  async preHandler(req: FastifyRequest, reply: FastifyReply) {
    // TODO: Implement logic to resolve the client
    console.log('Resolving client...');
  }
}
