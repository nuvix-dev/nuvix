import type { SchemaType } from '@nuvix/pg';
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

export type DatabaseConfig = {
  postgres: {
    host: string;
    port: number;
    database: string;
    password: string;
    // ssl
  };
  pool: {
    host: string;
    port: number;
    database: string;
    password: string;
  };
};

export type Schema = {
  id: number;
  name: string;
  type: SchemaType;
  enabled: boolean;
  metadata: Record<string, any>;
};

type KeyArgs = {
  ip: string;
  params: Record<string, any>;
  body: Record<string, any>;
};

export type ThrottleOptions = {
  limit: number;
  ttl: number; // time to live in seconds
  key?: string | ((args: KeyArgs) => string | string[]);
};
