import { Injectable, Logger } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Document } from '@nuvix/database';
import { PROJECT, SERVER_CONFIG } from 'src/Utils/constants';
import { Hook } from '../../server/hooks/interface';
import {
  addOriginToVaryHeader,
  addAccessControlRequestHeadersToVaryHeader,
} from 'src/core/helper/vary.helper';

interface CorsOptions {
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  preflight: boolean;
  strictPreflight: boolean;
  origin?: string | false;
}

// TODO: make this system more secure and dynamic for production
@Injectable()
export class CorsHook implements Hook {
  private readonly logger = new Logger(CorsHook.name);

  private readonly defaultOptions: CorsOptions = {
    methods: SERVER_CONFIG.methods,
    allowedHeaders: SERVER_CONFIG.allowedHeaders,
    exposedHeaders: SERVER_CONFIG.exposedHeaders,
    credentials: SERVER_CONFIG.credentials,
    maxAge: SERVER_CONFIG.maxAge,
    preflight: true,
    strictPreflight: true,
  };

  async onRequest(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const hostname = req.hostname;
      const project: Document = req[PROJECT];
      const isConsoleRequest =
        project.getId() === 'console' || hostname === SERVER_CONFIG.host;

      const origin = req.headers.origin;
      this.logger.log(`Origin: ${origin}`);
      const validOrigin = this.determineOrigin(origin, isConsoleRequest);
      const options = { ...this.defaultOptions, origin: validOrigin };

      this.addCorsHeaders(reply, origin, options);
      this.handleVaryHeaders(reply, options);

      if (req.method.toUpperCase() === 'OPTIONS' && options.preflight) {
        this.handlePreflight(req, reply, options);
      }
    } catch (error) {
      this.logger.error(`CORS setup failed: ${error.message}`);
      reply.status(500).send('Internal Server Error');
    }
  }

  async onError(req: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const hostname = req.hostname;
      const project: Document = req[PROJECT];
      const isConsoleRequest =
        project.getId() === 'console' || hostname === SERVER_CONFIG.host;

      const origin = req.headers.origin;
      this.logger.log(`Origin: ${origin}`);
      const validOrigin = this.determineOrigin(origin, isConsoleRequest);
      const options = { ...this.defaultOptions, origin: validOrigin };

      this.addCorsHeaders(reply, origin, options);
      this.handleVaryHeaders(reply, options);

      if (req.method.toUpperCase() === 'OPTIONS' && options.preflight) {
        this.handlePreflight(req, reply, options);
      }
    } catch (error) {
      this.logger.error(`CORS setup failed: ${error.message}`);
      reply.status(500).send('Internal Server Error');
    }
  }

  private determineOrigin(origin: string, isConsole: boolean): string | false {
    if (isConsole) {
      return SERVER_CONFIG.allowedOrigins.includes(origin) ? origin : 'null';
    }
    // TODO: handle dynamic CORS validation
    return false; // Default fallback when not a console request
  }

  private addCorsHeaders(
    reply: FastifyReply,
    origin: string | false,
    options: CorsOptions,
  ) {
    if (origin) {
      reply.header('Access-Control-Allow-Origin', origin);
    } else {
      this.logger.log(
        'CORS: Origin not allowed, skipping Access-Control-Allow-Origin header',
      );
    }

    if (options.credentials) {
      reply.header('Access-Control-Allow-Credentials', 'true');
    }

    if (options.exposedHeaders?.length) {
      reply.header(
        'Access-Control-Expose-Headers',
        options.exposedHeaders.join(', '),
      );
    }
  }

  private handleVaryHeaders(
    reply: FastifyReply,
    options: typeof this.defaultOptions,
  ) {
    if (typeof options.origin === 'string' && options.origin !== '*') {
      addOriginToVaryHeader(reply);
    }
    addAccessControlRequestHeadersToVaryHeader(reply);
  }

  private handlePreflight(
    req: FastifyRequest,
    reply: FastifyReply,
    options: typeof this.defaultOptions,
  ) {
    const origin = req.headers.origin;
    if (!origin || !SERVER_CONFIG.allowedOrigins.includes(origin)) {
      reply
        .status(403)
        .header('Content-Type', 'text/plain')
        .send('Origin not allowed');
      return;
    }

    if (
      options.strictPreflight &&
      (!origin || !req.headers['access-control-request-method'])
    ) {
      reply
        .status(400)
        .header('Content-Type', 'text/plain')
        .send('Invalid Preflight Request');
      return;
    }

    reply.header('Access-Control-Allow-Methods', options.methods.join(', '));

    if (options.allowedHeaders?.length) {
      reply.header(
        'Access-Control-Allow-Headers',
        options.allowedHeaders.join(', '),
      );
    }

    if (options.maxAge) {
      reply.header('Access-Control-Max-Age', String(options.maxAge));
    }

    reply.status(204).header('Content-Length', '0').send();
  }
}
