import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Doc } from '@nuvix/db'
import { AppMode, Context } from '@nuvix/utils'
import { ProjectsDoc, UsersDoc } from '@nuvix/utils/types'

export const User = createParamDecorator<any, UsersDoc | null>(
  (_data: unknown, ctx: ExecutionContext): UsersDoc => {
    const request: NuvixRequest = ctx.switchToHttp().getRequest()

    const project: ProjectsDoc = request[Context.Project]
    const user: UsersDoc = request[Context.User]
    const mode: AppMode = request[Context.Mode]

    if (
      project.empty() ||
      project.getId() === 'console' ||
      user.empty() ||
      mode === AppMode.ADMIN
    ) {
      return new Doc()
    }

    return user
  },
)
