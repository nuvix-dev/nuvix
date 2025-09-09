import { Injectable, Logger } from '@nestjs/common';
import { Context } from '@nuvix/utils';
import { Hook } from '../../server/hooks/interface';
import {
  addOriginToVaryHeader,
  addAccessControlRequestHeadersToVaryHeader,
} from '@nuvix/core/helper/vary.helper';
import { ProjectsDoc } from '@nuvix/utils/types';
import { AppConfigService } from '@nuvix/core/config.service';
import { Origin } from '@nuvix/core/validators/network/origin';

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

  constructor(private readonly appConfig: AppConfigService) {}

  private get defaultOptions(): CorsOptions {
    const config = this.appConfig.get('server');
    return {
      methods: config.methods,
      allowedHeaders: config.allowedHeaders,
      exposedHeaders: config.exposedHeaders,
      credentials: config.credentials,
      maxAge: 3600,
      preflight: true,
      strictPreflight: true,
    };
  }

  async onRequest(req: NuvixRequest, reply: NuvixRes): Promise<void> {
    try {
      const host = req.host;
      const project: ProjectsDoc | null = req[Context.Project] ?? null;

      const origin = req.headers.origin;
      const validOrigin = this.determineOrigin(origin, project, host);
      const options = { ...this.defaultOptions, origin: validOrigin };

      this.addCorsHeaders(reply, origin, options);
      this.handleVaryHeaders(reply, options);

      if (req.method.toUpperCase() === 'OPTIONS' && options.preflight) {
        this.handlePreflight(req, reply, options);
      }
    } catch (error: any) {
      this.logger.error(`CORS setup failed: ${error.message}`);
      reply.status(500).send('Internal Server Error');
    }
  }

  private determineOrigin(
    origin: string | undefined,
    project: ProjectsDoc | null,
    host: string,
  ): string | false {
    const serverConfig = this.appConfig.get('server');
    if (!project || project.empty()) return false;

    const isConsoleRequest =
      project.getId() === 'console' || host === serverConfig.host;

    if (!origin) return false; // No origin provided

    if (isConsoleRequest) {
      return this.matchOrigin(
        origin,
        this.appConfig.get('server').allowedOrigins,
        host,
      )
        ? host
        : false;
    }

    const validator = new Origin(project.get('platforms', []));
    if (validator.$valid(origin)) {
      return host; // TODO: validate against project-specific allowed origins
    }

    return false;
  }

  private matchOrigin(
    origin: string,
    allowedOrigins: string[],
    requestHost: string,
  ): boolean {
    if (!origin) {
      return false;
    }

    // Allow all origins if wildcard is present
    if (allowedOrigins.includes('*')) {
      return true;
    }

    // Exact match
    if (allowedOrigins.includes(origin)) {
      return true;
    }

    try {
      const originUrl = new URL(origin);
      const originHostname = originUrl.hostname;

      // Check if origin hostname matches request host
      if (originHostname === requestHost) {
        return true;
      }

      // Check wildcard patterns
      for (const allowedOrigin of allowedOrigins) {
        if (allowedOrigin.startsWith('*.')) {
          const wildcardDomain = allowedOrigin.slice(2); // Remove '*.'

          // Check if origin ends with the wildcard domain
          if (originHostname.endsWith(wildcardDomain)) {
            // Ensure it's a proper subdomain match (not partial match)
            const beforeDomain = originHostname.slice(
              0,
              -wildcardDomain.length,
            );
            if (beforeDomain === '' || beforeDomain.endsWith('.')) {
              return true;
            }
          }
        } else if (allowedOrigin.includes('*')) {
          // Handle other wildcard patterns using regex
          const regexPattern = allowedOrigin
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
            .replace(/\\\*/g, '.*'); // Replace escaped * with .*

          const regex = new RegExp(`^${regexPattern}$`, 'i');
          if (regex.test(origin)) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      this.logger.warn(`Invalid origin URL: ${origin}`);
      return false;
    }
  }

  private addCorsHeaders(
    reply: NuvixRes,
    origin: string | undefined,
    options: CorsOptions,
  ) {
    if (options.origin && origin) {
      reply.raw.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      reply.raw.setHeader('Access-Control-Allow-Origin', 'null');
    }

    if (options.credentials) {
      reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    if (options.exposedHeaders?.length) {
      reply.raw.setHeader(
        'Access-Control-Expose-Headers',
        options.exposedHeaders.join(', '),
      );
    }
  }

  private handleVaryHeaders(
    reply: NuvixRes,
    options: typeof this.defaultOptions,
  ) {
    if (typeof options.origin === 'string' && options.origin !== '*') {
      addOriginToVaryHeader(reply);
    }
    addAccessControlRequestHeadersToVaryHeader(reply);
  }

  private handlePreflight(
    req: NuvixRequest,
    reply: NuvixRes,
    options: typeof this.defaultOptions,
  ) {
    const origin = req.headers.origin;
    if (
      !origin ||
      !this.appConfig.get('server').allowedOrigins.includes(origin)
    ) {
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

    reply.raw.setHeader(
      'Access-Control-Allow-Methods',
      options.methods.join(', '),
    );

    if (options.allowedHeaders?.length) {
      reply.raw.setHeader(
        'Access-Control-Allow-Headers',
        options.allowedHeaders.join(', '),
      );
    }

    if (options.maxAge) {
      reply.raw.setHeader('Access-Control-Max-Age', String(options.maxAge));
    }

    reply.status(204).header('Content-Length', '0').send();
  }
}
