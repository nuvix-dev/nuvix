import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Database, Document } from '@nuvix/database';
import { DataSource } from '@nuvix/pg';
import {
  CORE_SCHEMA_DB,
  CURRENT_SCHEMA_DB,
  CURRENT_SCHEMA_PG,
  PROJECT,
  PROJECT_PG,
} from '@nuvix/utils/constants';
import { Exception } from '../extend/exception';

export const Project = createParamDecorator<Document>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();

    const project = request[PROJECT] as Document;

    if (project.isEmpty() || project.getId() === 'console') {
      return new Document();
    }
    return project;
  },
);

export const ProjectDatabase = createParamDecorator<any, Database>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const database = request[CORE_SCHEMA_DB] as Database;
    return database;
  },
);

export const CurrentDatabase = createParamDecorator<any, Database>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const project = request[PROJECT] as Document;
    const database = request[CURRENT_SCHEMA_DB] as Database;
    return database;
  },
);

export const CurrentSchema = createParamDecorator<any, DataSource | undefined>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const database = request[CURRENT_SCHEMA_PG] as DataSource;
    if (!database) throw new Exception(Exception.SCHEDULE_NOT_FOUND);
    return database;
  },
);

export const ProjectPg = createParamDecorator<any, DataSource | undefined>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const dataSource = request[PROJECT_PG] as DataSource;
    if (!dataSource) throw new Exception(Exception.DATABASE_NOT_FOUND);
    return dataSource;
  },
);
