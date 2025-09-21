import { Injectable } from '@nestjs/common';
import { ProjectHook as BaseProjectHook } from '@nuvix/core/resolvers';
import { DatabaseRole } from '@nuvix/utils';

@Injectable()
export class ProjectHook extends BaseProjectHook {
  protected override dbRole: DatabaseRole = DatabaseRole.POSTGRES;
}
