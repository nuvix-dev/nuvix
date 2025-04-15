export interface ServerConfig {
  host: string;
  methods: string[];
  allowedOrigins: string[];
  allowedHeaders: string[];
  credentials: boolean;
  exposedHeaders: string[];
  functionsDomain?: string;
  routerProtection: boolean;
  maxAge?: number;
  cookieDomain?: string;
}
