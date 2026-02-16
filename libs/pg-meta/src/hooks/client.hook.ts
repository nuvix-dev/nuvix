import { Injectable } from '@nestjs/common'
import { Exception } from '@nuvix/core/extend/exception'
import { Hook } from '@nuvix/core/server'
import { Doc } from '@nuvix/db'
import { Context } from '@nuvix/utils'
import { CLIENT } from '../constants'
import { PostgresMeta } from '../lib'
import { CoreService } from '@nuvix/core/core.service'

@Injectable()
export class ResolveClient implements Hook {
  constructor(private readonly coreService: CoreService) {}

  async preHandler(req: NuvixRequest) {
    const project = req[Context.Project] as Doc

    if (project.empty() || project.getId() === 'console') {
      throw new Exception(Exception.PROJECT_NOT_FOUND)
    }

    const pool = this.coreService.getPoolForPostgres()

    req[CLIENT] = new PostgresMeta(pool)
    return
  }
}
