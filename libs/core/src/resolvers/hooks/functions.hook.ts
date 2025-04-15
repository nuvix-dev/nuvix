import { Inject, Injectable } from '@nestjs/common';
import { Document } from '@nuvix/database';
import { FastifyRequest } from 'fastify';
import { GetProjectDbFn } from '@nuvix/core/core.module';
import { Exception } from '@nuvix/core/extend/exception';
import { Hook } from '@nuvix/core/server';
import {
  FUNCTIONS_SCHEMA_DB,
  GET_PROJECT_DB,
  PROJECT,
  PROJECT_POOL,
} from '@nuvix/utils/constants';

@Injectable()
export class FunctionsHook implements Hook {
  constructor(
    @Inject(GET_PROJECT_DB) private readonly getProjectDB: GetProjectDbFn,
  ) {}

  async preHandler(request: FastifyRequest) {
    const project = request[PROJECT] as Document;
    if (project.isEmpty() || project.getId() === 'console') {
      throw new Exception(Exception.PROJECT_NOT_FOUND);
    }

    const pool = request[PROJECT_POOL];
    const db = this.getProjectDB(pool, project.getId());
    db.setDatabase('functions');
    request[FUNCTIONS_SCHEMA_DB] = db;
    return null;
  }
}
