/** Resolves publishable-key project context without forcing unrelated routes to require a tenant. */
import type { ResolvedProject } from '@nuvix/core/platform'
import { Elysia } from 'elysia'
import { HEADERS } from '../shared/constants'
import { BadRequestError, NotFoundError } from '../shared/errors'

/** Narrow read boundary this module depends on — satisfied by `ProjectRegistry`. */
export interface ProjectLookup {
  resolve(publishableKey: string): Promise<ResolvedProject | null>
}

export type ProjectContext =
  | { status: 'absent' }
  | { status: 'invalid' }
  | { status: 'resolved'; project: ResolvedProject }

export async function resolveProjectContext(
  headers: Headers,
  lookup: ProjectLookup,
): Promise<ProjectContext> {
  const key = headers.get(HEADERS.publishableKey)
  if (!key) return { status: 'absent' }

  const project = await lookup.resolve(key)
  return project ? { status: 'resolved', project } : { status: 'invalid' }
}

/** Convert absent or invalid project context into the typed error expected by tenant-aware routes. */
export function requireProject(context: ProjectContext): ResolvedProject {
  if (context.status === 'resolved') return context.project
  if (context.status === 'absent') {
    throw new BadRequestError('Publishable key is required', {
      code: 'publishable_key_required',
    })
  }
  throw new NotFoundError('Project', { code: 'project_not_found' })
}

/** Expose project context at plugin scope for downstream tenant-aware routes. */
export function projectContext(options: { lookup: ProjectLookup }) {
  return new Elysia({ name: 'project-context' }).derive(
    // Plugin scope lets composed route modules consume the resolved project context.
    'plugin',
    async ({ request }) => ({
      project: await resolveProjectContext(request.headers, options.lookup),
    }),
  )
}
