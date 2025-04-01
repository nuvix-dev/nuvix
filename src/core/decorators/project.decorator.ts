import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Database, Document } from '@nuvix/database';
import {
  AUTH_SCHEMA_DB,
  FUNCTIONS_SCHEMA_DB,
  MESSAGING_SCHEMA_DB,
  PROJECT,
  STORAGE_SCHEMA_DB,
} from 'src/Utils/constants';

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

export const AuthDatabase = createParamDecorator<any, Database>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const project = request[PROJECT] as Document;
    const database = request[AUTH_SCHEMA_DB] as Database;
    database.setPrefix(project.getId());
    return database;
  },
);

export const StorageDatabase = createParamDecorator<any, Database>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const project = request[PROJECT] as Document;
    const database = request[STORAGE_SCHEMA_DB] as Database;
    database.setPrefix(project.getId());
    return database;
  },
);

export const FunctionsDatabase = createParamDecorator<any, Database>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const project = request[PROJECT] as Document;
    const database = request[FUNCTIONS_SCHEMA_DB] as Database;
    database.setPrefix(project.getId());
    return database;
  },
);

export const MessagingDatabase = createParamDecorator<any, Database>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: Request = ctx.switchToHttp().getRequest();
    const project = request[PROJECT] as Document;
    const database = request[MESSAGING_SCHEMA_DB] as Database;
    database.setPrefix(project.getId());
    return database;
  },
);
