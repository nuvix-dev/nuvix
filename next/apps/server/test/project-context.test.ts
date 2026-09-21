import { describe, expect, test } from "bun:test";
import { treaty } from "@elysia/eden";
import { Elysia } from "elysia";
import {
	type ProjectContext,
	type ProjectLookup,
	projectContext,
	requireProject,
} from "../src/context/project";

const ACTIVE_PROJECT = {
	id: "proj_1",
	target: { host: "h", port: 5432, database: "d", user: "u", password: "p" },
};

const lookup: ProjectLookup = {
	resolve: async (key) => (key === "pk_valid" ? ACTIVE_PROJECT : null),
};

/** Probe route exposing the resolved project context. */
const app = new Elysia({ prefix: "/v2" })
	.use(projectContext({ lookup }))
	.get("/whoami", ({ project }) => ({ project }));

const client = treaty(app);

function h(headers: Record<string, string>) {
	return { headers };
}

describe("project context resolution", () => {
	test("no header → absent", async () => {
		const { data } = await client.v2.whoami.get();
		expect((data!.project as ProjectContext).status).toBe("absent");
	});

	test("unknown key → invalid", async () => {
		const res = await app.handle(
			new Request(
				"http://x/v2/whoami",
				h({ "x-nuvix-publishable-key": "pk_unknown" }),
			),
		);
		const body = (await res.json()) as { project: ProjectContext };
		expect(body.project.status).toBe("invalid");
	});

	test("valid key → resolved with the project", async () => {
		const res = await app.handle(
			new Request(
				"http://x/v2/whoami",
				h({ "x-nuvix-publishable-key": "pk_valid" }),
			),
		);
		const body = (await res.json()) as { project: ProjectContext };
		expect(body.project).toEqual({
			status: "resolved",
			project: ACTIVE_PROJECT,
		});
	});
});

describe("requireProject", () => {
	test("resolved → returns the project", () => {
		const context: ProjectContext = {
			status: "resolved",
			project: ACTIVE_PROJECT,
		};
		expect(requireProject(context)).toBe(ACTIVE_PROJECT);
	});

	test("absent → 400 publishable_key_required", () => {
		expect(() => requireProject({ status: "absent" })).toThrowError(
			expect.objectContaining({
				status: 400,
				fields: expect.objectContaining({ code: "publishable_key_required" }),
			}),
		);
	});

	test("invalid → 404 project_not_found", () => {
		expect(() => requireProject({ status: "invalid" })).toThrowError(
			expect.objectContaining({
				status: 404,
				fields: expect.objectContaining({ code: "project_not_found" }),
			}),
		);
	});
});
