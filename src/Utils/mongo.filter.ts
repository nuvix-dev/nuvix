import { Model, Query } from 'mongoose';
import { Exception } from 'src/core/extend/exception';

interface QueryOptions {
  method: string;
  attribute?: string;
  values: any[];
}

export class QueryBuilder {
  private model: Query<any, any>;
  private query: any = {};
  private options: any = { limit: 25, skip: 0 }; // Default options

  static readonly OPTIONAL_ATTRIBUTES = [
    'limit',
    'orgId',
    'id',
    'updatedAt',
    'cursorAfter',
    'cursorBefore',
    'offset',
    'orderAsc',
    'orderDesc',
  ]

  private ALLOWED_ATTRIBUTES = [
    '$id',
    '$createdAt',
    '$updatedAt',
  ];

  constructor(model: Query<any, any>, allowedAttributes: string[] = []) {
    this.model = model;
    this.ALLOWED_ATTRIBUTES.push(...allowedAttributes);
  }

  // Set allowed attributes for validation
  validateAttribute(attribute: string) {
    if (!this.ALLOWED_ATTRIBUTES.includes(attribute)) {
      throw new Error(`Invalid attribute: ${attribute}. Allowed attributes are: ${this.ALLOWED_ATTRIBUTES.join(', ')}`);
    }
  }

  validateQuery(query: QueryOptions) {
    const { method, attribute, values } = query;

    if (attribute && !QueryBuilder.OPTIONAL_ATTRIBUTES.includes(attribute)) this.validateAttribute(attribute);

    switch (method) {
      case 'equal':
      case 'notEqual':
      case 'lessThan':
      case 'greaterThan':
      case 'greaterThanEqual':
      case 'lessThanEqual':
      case 'contains':
      case 'search':
      case 'isNull':
      case 'isNotNull':
      case 'between':
      case 'startsWith':
      case 'endsWith':
        if (!attribute || !values) {
          throw new Exception(Exception.GENERAL_QUERY_INVALID, 'Invalid query format');
        }
        break;
      case 'limit':
      case 'offset':
        if (!values) {
          throw new Exception(Exception.GENERAL_QUERY_INVALID, 'Invalid query format');
        }
        break;
      case 'orderAsc':
      case 'orderDesc':
        if (!attribute === undefined) {
          throw new Exception(Exception.GENERAL_QUERY_INVALID, 'Invalid query format');
        }
        break;
      case 'cursorAfter':
      case 'cursorBefore':
        if (!attribute || !values) {
          throw new Exception(Exception.GENERAL_QUERY_INVALID, 'Invalid query format');
        }
        break;
      case 'and':
      case 'or':
        if (!values) {
          throw new Exception(Exception.GENERAL_QUERY_INVALID, 'Invalid query format');
        }
        break;
      default:
        throw new Exception(Exception.GENERAL_QUERY_INVALID, `Unknown query method: ${method}`);
    }
  }

  parseQueryStrings(queryStrings?: string[]): void {
    const queries: QueryOptions[] = [];

    queryStrings?.forEach(queryString => {
      try {
        // Decode the query string
        const decodedQuery = decodeURIComponent(queryString);

        // Parse the JSON query
        const parsedQuery = JSON.parse(decodedQuery);

        // Validate the query
        this.validateQuery(parsedQuery);

        // Convert special attributes
        if (parsedQuery.attribute) {
          if (parsedQuery.attribute === '$id') parsedQuery.attribute = 'id';
          if (parsedQuery.attribute === '$updatedAt') parsedQuery.attribute = 'updatedAt';
          if (parsedQuery.attribute === '$createdAt') parsedQuery.attribute = 'createdAt';
          if (parsedQuery.attribute === 'teamId') parsedQuery.attribute = 'orgId';
        }

        queries.push(parsedQuery);
      } catch (error) {
        // Throw a more informative error
        throw new Exception(Exception.GENERAL_QUERY_INVALID, `Error parsing query string: ${error.message}`);
      }
    });

    // Parse the validated queries
    this.parseQueries(queries);
  }

  parseQueries(queries?: QueryOptions[], validate = false): void {
    queries?.forEach(query => {
      const { method, attribute, values } = query;

      if (validate) this.validateQuery(query);

      switch (method) {
        case 'equal':
          this.query[attribute] = { $in: values };
          break;
        case 'notEqual':
          this.query[attribute] = { $nin: values };
          break;
        case 'lessThan':
          this.query[attribute] = { $lt: values[0] };
          break;
        case 'lessThanEqual':
          this.query[attribute] = { $lte: values[0] };
          break;
        case 'greaterThan':
          this.query[attribute] = { $gt: values[0] };
          break;
        case 'greaterThanEqual':
          this.query[attribute] = { $gte: values[0] };
          break;
        case 'contains':
          this.query[attribute] = { $elemMatch: { $in: values } }; // For array fields
          break;
        case 'search':
          this.query[attribute] = { $regex: values[0], $options: 'i' }; // Case-insensitive search
          break;
        case 'isNull':
          this.query[attribute] = { $exists: false };
          break;
        case 'isNotNull':
          this.query[attribute] = { $exists: true };
          break;
        case 'between':
          this.query[attribute] = { $gte: values[0], $lte: values[1] };
          break;
        case 'startsWith':
          this.query[attribute] = { $regex: `^${values[0]}`, $options: 'i' }; // Starts with
          break;
        case 'endsWith':
          this.query[attribute] = { $regex: `${values[0]}$`, $options: 'i' }; // Ends with
          break;
        case 'limit':
          this.options.limit = values[0];
          break;
        case 'offset':
          this.options.skip = values[0];
          break;
        case 'orderAsc':
          if (attribute) {
            this.options.sort = { [attribute]: 1 }; // Ascending order
          } else {
            this.options.sort = { createdAt: 1 }; // Ascending order without attribute
          }
          break;
        case 'orderDesc':
          if (attribute) {
            this.options.sort = { [attribute]: -1 }; // Descending order
          } else {
            this.options.sort = { createdAt: -1 }; // Descending order without attribute 
          }
          break;
        case 'cursorAfter':
          this.options.cursorAfter = values[0]; // Handle cursor logic here if needed
          break;
        case 'cursorBefore':
          this.options.cursorBefore = values[0]; // Handle cursor logic here if needed
          break;
        case 'and':
          this.handleLogicalOperator('and', values);
          break;
        case 'or':
          this.handleLogicalOperator('or', values);
          break;
        default:
          throw new Error(`Unknown query method: ${method}`);
      }
    });
  }

  // Handle logical operators
  private handleLogicalOperator(operator: 'and' | 'or', queries: QueryOptions[]) {
    const combinedQueries = queries.map(q => {
      const { method, attribute, values } = q;
      if (attribute && !QueryBuilder.OPTIONAL_ATTRIBUTES.includes(attribute)) this.validateAttribute(attribute);
      switch (method) {
        case 'equal':
          return { [attribute]: { $in: values } };
        case 'notEqual':
          return { [attribute]: { $nin: values } };
        case 'lessThan':
          return { [attribute]: { $lt: values[0] } };
        case 'greaterThan':
          return { [attribute]: { $gt: values[0] } };
        case 'greaterThanEqual':
          return { [attribute]: { $gte: values[0] } };
        case 'lessThanEqual':
          return { [attribute]: { $lte: values[0] } };
        case 'contains':
          return { [attribute]: { $elemMatch: { $in: values } } };
        case 'search':
          return { [attribute]: { $regex: values[0], $options: 'i' } };
        case 'isNull':
          return { [attribute]: { $exists: false } };
        case 'isNotNull':
          return { [attribute]: { $exists: true } };
        case 'between':
          return { [attribute]: { $gte: values[0], $lte: values[1] } };
        case 'startsWith':
          return { [attribute]: { $regex: `^${values[0]}`, $options: 'i' } };
        case 'endsWith':
          return { [attribute]: { $regex: `${values[0]}$`, $options: 'i' } };
        default:
          throw new Error(`Unknown query method in logical operator: ${method}`);
      }
    });

    this.query[operator === 'and' ? '$and' : '$or'] = combinedQueries;
  }

  async execute() {
    const cursorQuery = this.options.cursorAfter ? { _id: { $gt: this.options.cursorAfter } } : {};
    const finalQuery = { ...this.query, ...cursorQuery };

    // Get total count without limit and skip
    const totalCount = await this.model.clone().find(finalQuery).countDocuments();

    // Get paginated results
    const results = await this.model.clone().find(finalQuery)
      .sort(this.options.sort)
      .limit(this.options.limit)
      .skip(this.options.skip);

    return {
      results,
      totalCount,
      limit: this.options.limit,
      skip: this.options.skip
    };
  }
}