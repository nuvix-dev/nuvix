import type configuration from './configuration.js';

export interface ServerConfig {
  host: string;
  methods: string[];
  allowedOrigins: (string | RegExp)[];
  allowedHeaders: string[];
  credentials: boolean;
  exposedHeaders: string[];
  functionsDomain?: string;
  routerProtection: boolean;
  maxAge?: number;
  cookieDomain?: string;
}

export type Configuration = ReturnType<typeof configuration>;
