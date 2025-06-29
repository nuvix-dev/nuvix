import type { DataSource } from '@nuvix/pg';

export interface Select {
  schema: string;
  pg: DataSource;
  table: string;
  url: string;
  limit?: number;
  offset?: number;
}

export interface Insert {
  pg: DataSource;
  table: string;
  input:
    | Record<string, string | number | null | boolean>
    | Record<string, string | number | null | boolean>[];
  columns?: string[];
}
