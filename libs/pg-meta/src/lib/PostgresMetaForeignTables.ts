import { literal } from 'pg-format';
import { coalesceRowsToArray, filterByList } from './helpers';
import { columnsSql, foreignTablesSql } from './sql/index';
import { PostgresMetaResult, PostgresForeignTable } from './types';
import { PgMetaException } from '../extra/execption';

export default class PostgresMetaForeignTables {
  query: (sql: string) => Promise<PostgresMetaResult<any>>;

  constructor(query: (sql: string) => Promise<PostgresMetaResult<any>>) {
    this.query = query;
  }

  async list(options: {
    includedSchemas?: string[];
    excludedSchemas?: string[];
    limit?: number;
    offset?: number;
    includeColumns: false;
  }): Promise<
    PostgresMetaResult<(PostgresForeignTable & { columns: never; })[]>
  >;
  async list(options?: {
    includedSchemas?: string[];
    excludedSchemas?: string[];
    limit?: number;
    offset?: number;
    includeColumns?: boolean;
  }): Promise<
    PostgresMetaResult<(PostgresForeignTable & { columns: unknown[]; })[]>
  >;
  async list({
    includedSchemas,
    excludedSchemas,
    limit,
    offset,
    includeColumns = true,
  }: {
    includedSchemas?: string[];
    excludedSchemas?: string[];
    limit?: number;
    offset?: number;
    includeColumns?: boolean;
  } = {}): Promise<PostgresMetaResult<PostgresForeignTable[]>> {
    let sql = generateEnrichedForeignTablesSql({ includeColumns });
    const filter = filterByList(includedSchemas, excludedSchemas);
    if (filter) {
      sql += ` where schema ${filter}`;
    }
    if (limit) {
      sql += ` limit ${limit}`;
    }
    if (offset) {
      sql += ` offset ${offset}`;
    }
    return this.query(sql);
  }

  async retrieve({
    id,
  }: {
    id: number;
  }): Promise<PostgresMetaResult<PostgresForeignTable>>;
  async retrieve({
    name,
    schema,
  }: {
    name: string;
    schema: string;
  }): Promise<PostgresMetaResult<PostgresForeignTable>>;
  async retrieve({
    id,
    name,
    schema = 'public',
  }: {
    id?: number;
    name?: string;
    schema?: string;
  }): Promise<PostgresMetaResult<PostgresForeignTable>> {
    if (id) {
      const sql = `${generateEnrichedForeignTablesSql({
        includeColumns: true,
      })} where foreign_tables.id = ${literal(id)};`;
      const { data, error } = await this.query(sql);
      if (error) {
        return { data, error };
      } else if (data.length === 0) {
        throw new PgMetaException(`Cannot find a foreign table with ID ${id}`);
      } else {
        return { data: data[0], error };
      }
    } else if (name) {
      const sql = `${generateEnrichedForeignTablesSql({
        includeColumns: true,
      })} where foreign_tables.name = ${literal(name)} and foreign_tables.schema = ${literal(
        schema,
      )};`;
      const { data, error } = await this.query(sql);
      if (error) {
        return { data, error };
      } else if (data.length === 0) {
        throw new PgMetaException(
          `Cannot find a foreign table named ${name} in schema ${schema}`,
        );
      } else {
        return { data: data[0], error };
      }
    } else {
      throw new PgMetaException('Invalid parameters on foreign table retrieve');
    }
  }
}

const generateEnrichedForeignTablesSql = ({
  includeColumns,
}: {
  includeColumns: boolean;
}) => `
with foreign_tables as (${foreignTablesSql})
  ${includeColumns ? `, columns as (${columnsSql})` : ''}
select
  *
  ${includeColumns
    ? `, ${coalesceRowsToArray('columns', 'columns.table_id = foreign_tables.id')}`
    : ''
  }
from foreign_tables`;
