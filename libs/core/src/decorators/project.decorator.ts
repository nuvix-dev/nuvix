import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Database, Doc } from '@nuvix-tech/db';
import { DataSource } from '@nuvix/pg';
import {
  AUDITS_FOR_PROJECT,
  Context,
  CORE_SCHEMA_DB,
  CURRENT_SCHEMA_DB,
  CURRENT_SCHEMA_PG,
  PROJECT_PG,
} from '@nuvix/utils';
import { Exception } from '../extend/exception';
import { Audit } from '@nuvix/audit';
import { ProjectsDoc } from '@nuvix/utils/types';

export const Project = createParamDecorator<ProjectsDoc>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest();

    const project = request[Context.User] as ProjectsDoc;

    if (project.empty() || project.getId() === 'console') {
      return new Doc();
    }
    return project;
  },
);

export const ProjectDatabase = createParamDecorator<any, Database>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest();
    const database = request[CORE_SCHEMA_DB] as Database;
    return database;
  },
);

export const CurrentDatabase = createParamDecorator<any, Database>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest();
    const database = request[CURRENT_SCHEMA_DB] as Database;
    return database;
  },
);

export const CurrentSchema = createParamDecorator<any, DataSource | undefined>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest();
    const database = request[CURRENT_SCHEMA_PG] as DataSource;
    if (!database) throw new Exception(Exception.SCHEDULE_NOT_FOUND);
    return database;
  },
);

export const ProjectPg = createParamDecorator<any, DataSource | undefined>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest();
    const dataSource = request[PROJECT_PG] as DataSource;
    if (!dataSource) throw new Exception(Exception.DATABASE_NOT_FOUND);
    return dataSource;
  },
);

export const ProjectAudits = createParamDecorator<any, Audit>(
  (data: unknown, ctx: ExecutionContext) => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest();
    const audit = request[AUDITS_FOR_PROJECT] as Audit;
    return audit;
  },
);
