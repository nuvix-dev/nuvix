/**
 * Project routes — thin HTTP layer over `ProjectService`.
 * Contract: docs/api/platform.md
 *
 * NOTE (elysia 2.0.0-beta.6): route signature is `.get(path, hook, handler)` —
 * the schema/hook object comes BEFORE the handler.
 */

import { Elysia, t } from "elysia";
import type { ProjectService } from "./service";

const ProjectSchema = t.Object({
	$id: t.String(),
	name: t.String(),
	status: t.Union([
		t.Literal("provisioning"),
		t.Literal("active"),
		t.Literal("error"),
	]),
	publishableKey: t.String(),
	containerName: t.String(),
	volumeName: t.String(),
	errorMessage: t.Optional(t.String()),
	$createdAt: t.Any(),
	$updatedAt: t.Any(),
});

export function projectRoutes(service: ProjectService) {
	return new Elysia({ name: "project-routes" })
		.post(
			"/projects",
			{
				body: t.Object({
					name: t.String({ minLength: 1, maxLength: 128 }),
					id: t.Optional(t.String({ maxLength: 36 })),
				}),
				response: ProjectSchema,
				detail: { summary: "Create a project", tags: ["projects"] },
			},
			({ body }) => service.create(body),
		)
		.get(
			"/projects",
			{
				query: t.Object({
					limit: t.Optional(
						t.Integer({ minimum: 1, maximum: 100, default: 25 }),
					),
					offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
				}),
				response: t.Object({
					data: t.Array(ProjectSchema),
					meta: t.Object({
						total: t.Number(),
						limit: t.Number(),
						offset: t.Number(),
					}),
				}),
				detail: { summary: "List projects", tags: ["projects"] },
			},
			async ({ query }) => {
				const limit = query.limit ?? 25;
				const offset = query.offset ?? 0;
				const { projects, total } = await service.list(limit, offset);
				return { data: projects, meta: { total, limit, offset } };
			},
		)
		.get(
			"/projects/:id",
			{
				response: ProjectSchema,
				detail: { summary: "Get a project", tags: ["projects"] },
			},
			({ params }) => service.get(params.id),
		)
		.delete(
			"/projects/:id",
			{
				query: t.Object({ purge: t.Optional(t.Boolean({ default: false })) }),
				response: t.Void(),
				detail: { summary: "Delete a project", tags: ["projects"] },
			},
			async ({ params, query, set }) => {
				await service.delete(params.id, { purge: query.purge });
				set.status = 204;
			},
		);
}
