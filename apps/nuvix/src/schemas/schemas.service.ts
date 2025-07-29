import { Injectable, Logger } from '@nestjs/common';
import { CallFunction, Delete, Insert, Select, Update } from './schemas.types';
import {
  Expression,
  ParsedOrdering,
  ParserResult,
  SelectNode,
} from '@nuvix/utils/query/types';
import { Parser } from '@nuvix/utils/query/parser';
import { SelectParser } from '@nuvix/utils/query/select';
import { OrderParser } from '@nuvix/utils/query/order';
import { ASTToQueryBuilder } from '@nuvix/utils/query/builder';
import { Exception } from '@nuvix/core/extend/exception';
import { transformPgError } from '@nuvix/utils/database/pg-error';

@Injectable()
export class SchemasService {
  private readonly logger = new Logger(SchemasService.name);

  async select({ pg, table, url, limit, offset, schema }: Select) {
    const qb = pg.qb(table).withSchema(schema);
    const astToQueryBuilder = new ASTToQueryBuilder(qb, pg);

    const { filter, select, order } = this.getParamsFromUrl(url, table);

    astToQueryBuilder.applySelect(select);
    astToQueryBuilder.applyFilters(filter, {
      applyExtra: true,
      tableName: table,
    });
    astToQueryBuilder.applyOrder(order, table);
    astToQueryBuilder.applyLimitOffset({
      limit: limit ?? filter?.limit ?? 500,
      offset,
    });

    this.logger.debug(qb.toSQL());
    try {
      return await qb;
    } catch (e) {
      const error = transformPgError(e);
      if (!error || error.status >= 500) {
        throw new Exception(
          error.type ?? Exception.GENERAL_SERVER_ERROR,
          error.message ?? 'Database error',
          error.status,
        );
      }
      throw new Exception(error.type, error.message, error.status).addDetails({
        hint: error.details.hint,
        detail: error.details.detail,
      });
    }
  }

  async insert({ pg, table, input, columns, schema, url }: Insert) {
    if (!input) {
      throw new Exception(
        Exception.INVALID_PARAMS,
        'Input data is required for insert operation',
      );
    }
    const isArrayData = Array.isArray(input);

    let data: Record<string, any> | Record<string, any>[];

    if (columns?.length) {
      if (isArrayData) {
        data = input.map(record =>
          columns.reduce(
            (acc, column) => {
              acc[column] = record[column];
              return acc;
            },
            {} as Record<string, any>,
          ),
        );
      } else {
        data = columns.reduce(
          (acc, column) => {
            acc[column] = input[column];
            return acc;
          },
          {} as Record<string, any>,
        );
      }
    } else {
      data = input;
    }

    const qb = pg.qb(table).withSchema(schema);
    const { select } = this.getParamsFromUrl(url, table);
    const astToQueryBuilder = new ASTToQueryBuilder(qb, pg);

    astToQueryBuilder.applyReturning(select);
    qb.insert(data);

    this.logger.debug(qb.toSQL());

    try {
      return pg.withTransaction(async () => await qb);
    } catch (e) {
      const error = transformPgError(e);
      if (!error || error.status >= 500) {
        throw new Exception(
          error.type ?? Exception.GENERAL_SERVER_ERROR,
          error.message ?? 'Database error',
          error.status,
        );
      }
      throw new Exception(error.type, error.message, error.status).addDetails({
        hint: error.details.hint,
        detail: error.details.detail,
      });
    }
  }

  async update({
    pg,
    table,
    input,
    columns,
    schema,
    url,
    limit,
    offset,
    force = false,
  }: Update) {
    if (!input) {
      throw new Exception(
        Exception.INVALID_PARAMS,
        'Input data is required for update operation',
      );
    }
    let data: Record<string, any> | Record<string, any>[];

    if (columns?.length) {
      data = columns.reduce(
        (acc, column) => {
          acc[column] = input[column];
          return acc;
        },
        {} as Record<string, any>,
      );
    } else {
      data = input;
    }

    const qb = pg.qb(table).withSchema(schema);
    const { select, filter, order } = this.getParamsFromUrl(url, table);
    const astToQueryBuilder = new ASTToQueryBuilder(qb, pg);

    astToQueryBuilder.applyReturning(select);
    astToQueryBuilder.applyFilters(filter, {
      applyExtra: true,
      tableName: table,
      throwOnEmpty: force,
      throwOnEmptyError: new Exception(
        Exception.GENERAL_ACCESS_FORBIDDEN,
        'you must provide a filter to update data or use &force=true',
      ),
    });
    astToQueryBuilder.applyOrder(order, table);
    astToQueryBuilder.applyLimitOffset({
      limit,
      offset,
    });
    qb.update(data);

    this.logger.debug(qb.toSQL());

    try {
      return pg.withTransaction(async () => await qb);
    } catch (e) {
      const error = transformPgError(e);
      if (!error || error.status >= 500) {
        throw new Exception(
          error.type ?? Exception.GENERAL_SERVER_ERROR,
          error.message ?? 'Database error',
          error.status,
        );
      }
      throw new Exception(error.type, error.message, error.status).addDetails({
        hint: error.details.hint,
        detail: error.details.detail,
      });
    }
  }

  async delete({ pg, table, schema, url, limit, offset, force }: Delete) {
    const qb = pg.qb(table).withSchema(schema);
    const { select, filter, order } = this.getParamsFromUrl(url, table);
    const astToQueryBuilder = new ASTToQueryBuilder(qb, pg);

    astToQueryBuilder.applyReturning(select);
    astToQueryBuilder.applyFilters(filter, {
      applyExtra: true,
      tableName: table,
      throwOnEmpty: force,
      throwOnEmptyError: new Exception(
        Exception.GENERAL_ACCESS_FORBIDDEN,
        'you must provide a filter to delete data or use &force=true',
      ),
    });
    astToQueryBuilder.applyOrder(order, table);
    astToQueryBuilder.applyLimitOffset({
      limit,
      offset,
    });
    qb.delete();
    this.logger.debug(qb.toSQL());

    try {
      return pg.withTransaction(async () => await qb);
    } catch (e) {
      const error = transformPgError(e);
      if (!error || error.status >= 500) {
        throw new Exception(
          error.type ?? Exception.GENERAL_SERVER_ERROR,
          error.message ?? 'Database error',
          error.status,
        );
      }
      throw new Exception(error.type, error.message, error.status).addDetails({
        hint: error.details.hint,
        detail: error.details.detail,
      });
    }
  }

  async callFunction({
    pg,
    functionName,
    schema,
    url,
    limit,
    offset,
    args,
  }: CallFunction) {
    const _argNames = Object.keys(args || {});
    const _values = Object.values(args || {});

    const placeholder = _argNames.map(n => `${n}:= ?`).join(', ');
    const _raw = pg.raw(`??.??(${placeholder})`, [
      schema,
      functionName,
      ..._values,
    ]);
    const qb = pg.queryBuilder().table(_raw as any);

    const astToQueryBuilder = new ASTToQueryBuilder(qb, pg);

    const { select, filter, order } = this.getParamsFromUrl(url, functionName);

    astToQueryBuilder.applySelect(select);
    astToQueryBuilder.applyFilters(filter);
    astToQueryBuilder.applyOrder(order, functionName);
    astToQueryBuilder.applyLimitOffset({
      limit,
      offset,
    });
    this.logger.debug(qb.toSQL());

    try {
      return await qb;
    } catch (e) {
      const error = transformPgError(e);
      if (!error || error.status >= 500) {
        throw new Exception(
          error.type ?? Exception.GENERAL_SERVER_ERROR,
          error.message ?? 'Database error',
          error.status,
        );
      }
      throw new Exception(error.type, error.message, error.status).addDetails({
        hint: error.details.hint,
        detail: error.details.detail,
      });
    }
  }

  private getParamsFromUrl(
    url: string,
    tableName: string,
  ): {
    filter?: Expression & ParserResult;
    select?: SelectNode[];
    order?: ParsedOrdering[];
  } {
    const queryString = url.includes('?') ? url.split('?')[1] : '';
    const urlParams = new URLSearchParams(queryString);

    const _filter = urlParams.get('filter') || '';
    const filter = _filter
      ? Parser.create({ tableName }).parse(_filter)
      : undefined;

    const _select = urlParams.get('select') || '';
    const select = _select
      ? new SelectParser({ tableName }).parse(_select)
      : undefined;

    const _order = urlParams.get('order') || '';
    const order = _order ? OrderParser.parse(_order, tableName) : undefined;

    return { filter, select, order };
  }
}
