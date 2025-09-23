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

@Injectable()
export class CorsHook implements Hook {
  private readonly logger = new Logger(CorsHook.name);

  constructor(private readonly appConfig: AppConfigService) {}

  private get defaultOptions(): CorsOptions {
    const config = this.appConfig.get('server');
    return {
      methods: [...config.methods],
      allowedHeaders: [...config.allowedHeaders],
      exposedHeaders: [...config.exposedHeaders],
      credentials: config.credentials,
      maxAge: 3600,
      preflight: true,
      strictPreflight: true,
    };
  }

  async onRequest(req: NuvixRequest, reply: NuvixRes): Promise<void> {
    try {
      const project: ProjectsDoc | null = req[Context.Project] ?? null;
      const origin = req.headers.origin;
      const host = req.host;

      // Validate origin against console or project rules
      const validOrigin = this.determineOrigin(origin, project, host);
      const options = { ...this.defaultOptions, origin: validOrigin };

      this.addCorsHeaders(reply, options);
      this.handleVaryHeaders(reply, options);

      // Handle OPTIONS preflight
      if (req.method.toUpperCase() === 'OPTIONS' && options.preflight) {
        this.handlePreflight(req, reply, options);
      }
    } catch (error: any) {
      this.logger.error(`CORS setup failed: ${error.message}`);
      reply.status(500).send('Internal Server Error');
    }
  }

  /**
   * Validate the request origin:
   * - Console / platform requests use global server.allowedOrigins
   * - Project requests use project.platforms
   */
  private determineOrigin(
    origin: string | undefined,
    project: ProjectsDoc | null,
    host: string,
  ): string | false {
    if (!origin) return false;

    const serverConfig = this.appConfig.get('server');
    const isConsoleRequest =
      !project ||
      project?.empty() ||
      project?.getId() === 'console' ||
      host === serverConfig.host;

    if (isConsoleRequest) {
      return this.matchOrigin(origin, serverConfig.allowedOrigins, host)
        ? origin
        : false;
    }

    // Project-specific validation
    const validator = new Origin(project.get('platforms', []));
    return validator.$valid(origin) ? origin : false;
  }

  /**
   * Match origin against server allowed origins
   * Supports exact, subdomain, and wildcard matching
   */
  private matchOrigin(
    origin: string,
    allowedOrigins: string[],
    requestHost: string,
  ): boolean {
    if (!allowedOrigins?.length) return false;

    // Allow all if wildcard present (use request origin if credentials are enabled)
    if (allowedOrigins.includes('*')) return true;

    // Exact match
    if (allowedOrigins.includes(origin)) return true;

    try {
      const { hostname } = new URL(origin);

      // Allow same-host requests
      if (hostname === requestHost) return true;

      // Wildcard subdomains: *.example.com
      for (const allowed of allowedOrigins) {
        if (allowed.startsWith('*.') && hostname.endsWith(allowed.slice(1))) {
          return true;
        }

        if (allowed.includes('*')) {
          // Convert wildcard to regex
          const regexPattern = allowed
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\\\*/g, '.*');
          if (new RegExp(`^${regexPattern}$`, 'i').test(origin)) {
            return true;
          }
        }
      }

      return false;
    } catch {
      this.logger.warn(`Invalid origin: ${origin}`);
      return false;
    }
  }

  private addCorsHeaders(reply: NuvixRes, options: CorsOptions) {
    if (options.origin) {
      reply.raw.setHeader('Access-Control-Allow-Origin', options.origin);

      // If credentials are enabled, must reflect request origin
      if (options.credentials) {
        reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    } else {
      reply.raw.setHeader('Access-Control-Allow-Origin', 'null');
    }

    if (options.exposedHeaders?.length) {
      reply.raw.setHeader(
        'Access-Control-Expose-Headers',
        options.exposedHeaders.join(', '),
      );
    }
  }

  private handleVaryHeaders(reply: NuvixRes, options: CorsOptions) {
    if (options.origin && options.origin !== '*') {
      addOriginToVaryHeader(reply);
    }
    addAccessControlRequestHeadersToVaryHeader(reply);
  }

  private handlePreflight(
    req: NuvixRequest,
    reply: NuvixRes,
    options: CorsOptions,
  ) {
    if (!options.origin) {
      reply.status(403).send('Origin not allowed');
      return;
    }

    if (
      options.strictPreflight &&
      !req.headers['access-control-request-method']
    ) {
      reply.status(400).send('Invalid Preflight Request');
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
