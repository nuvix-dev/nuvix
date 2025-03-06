import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Document } from '@nuvix/database';
import { NextFunction, Request, Response } from 'express';
import { PROJECT, SERVER_CONFIG } from 'src/Utils/constants';
import cors from 'cors';

@Injectable()
export class CorsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorsMiddleware.name);

  async use(req: Request, res: Response, next: NextFunction) {
    const hostname = req.hostname;
    const project: Document = req[PROJECT];

    if (project.getId() === 'console' || hostname === SERVER_CONFIG.host) {
      cors({
        origin: SERVER_CONFIG.allowedOrigins,
        methods: SERVER_CONFIG.methods,
        allowedHeaders: SERVER_CONFIG.allowedHeaders,
        exposedHeaders: SERVER_CONFIG.exposedHeaders,
        credentials: SERVER_CONFIG.credentials,
      })(req, res, next);
      return;
    }

    cors({
      origin: false,
    })(req, res, next);
  }
}
