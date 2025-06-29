import { Injectable, Logger } from '@nestjs/common';
import { Insert, Select } from './schema.types';
import {
  Expression,
  ParsedOrdering,
  SelectNode,
} from '@nuvix/utils/query/types';
import { Parser } from '@nuvix/utils/query/parser';
import { SelectParser } from '@nuvix/utils/query/select';
import { OrderParser } from '@nuvix/utils/query/order';
import { ASTToQueryBuilder } from '@nuvix/utils/query/builder';

@Injectable()
export class SchemaService {
  private readonly logger = new Logger(SchemaService.name);

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
      limit,
      offset,
    });

    this.logger.debug(qb.toSQL());

    return await qb;
  }

  async insert({ pg, table, input, columns }: Insert) {
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

    const { qb } = pg;
    const result = await qb(table).insert(data).returning('*');

    return result;
  }

  private getParamsFromUrl(
    url: string,
    tableName: string,
  ): {
    filter?: Expression;
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
    const order = _order ? OrderParser.parse(_order) : undefined;

    return { filter, select, order };
  }
}
