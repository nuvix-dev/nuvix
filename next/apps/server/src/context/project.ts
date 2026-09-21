import type { ResolvedProject } from "@nuvix/core/platform";
import { Elysia } from "elysia";
import { HEADERS } from "../shared/constants";
import { BadRequestError, NotFoundError } from "../shared/errors";

/**
 * Project context resolution — publishable key → platform project → tenant
 * database coordinates (D20, D40; MIGRATION.md Phase 1 "context chain",
 * unblocked once `@nuvix/db`-backed tenant primitives landed in Phase 7).
 *
 * Resolution never throws: routes/services that don't need a tenant (locale,
 * avatars, health) simply ignore `project`. Routes that DO need one call
 * `requireProject()`, which turns the two failure states into typed errors.
 * Stateful lookup (the platform registry query) is pluggable, same pattern
 * as `AuthVerifiers` in `./auth.ts`.
 */

/** Narrow read boundary this module depends on — satisfied by `ProjectRegistry`. */
export interface ProjectLookup {
	resolve(publishableKey: string): Promise<ResolvedProject | null>;
}

export type ProjectContext =
	| { status: "absent" }
	| { status: "invalid" }
	| { status: "resolved"; project: ResolvedProject };

export async function resolveProjectContext(
	headers: Headers,
	lookup: ProjectLookup,
): Promise<ProjectContext> {
	const key = headers.get(HEADERS.publishableKey);
	if (!key) return { status: "absent" };

	const project = await lookup.resolve(key);
	return project ? { status: "resolved", project } : { status: "invalid" };
}

/**
 * Turns a non-resolved `ProjectContext` into the typed error a route/service
 * should surface. `absent` (caller forgot the header) and `invalid` (key
 * doesn't match an active project) are deliberately distinct: the publishable
 * key is not a secret (D40), so there's no oracle concern in telling the two
 * apart the way there would be for an actual credential.
 */
export function requireProject(context: ProjectContext): ResolvedProject {
	if (context.status === "resolved") return context.project;
	if (context.status === "absent") {
		throw new BadRequestError("Publishable key is required", {
			code: "publishable_key_required",
		});
	}
	throw new NotFoundError("Project", { code: "project_not_found" });
}

export function projectContext(options: { lookup: ProjectLookup }) {
	return new Elysia({ name: "project-context" }).derive(
		// NOTE: scope required — local-scoped derive does not cross .use() boundaries
		"plugin",
		async ({ request }) => ({
			project: await resolveProjectContext(request.headers, options.lookup),
		}),
	);
}
