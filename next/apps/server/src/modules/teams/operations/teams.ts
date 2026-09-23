import { Doc, ID, Permission, Query, Role, type Session } from "@nuvix/db";
import { ConflictError, NotFoundError } from "../../../shared/errors";
import type { Memberships, Teams, TeamsDoc } from "../../../types/generated";

export interface CreateTeamInput {
	teamId?: string;
	name: string;
	roles?: string[];
}

export interface CallerAuth {
	userId?: string;
	isPrivileged?: boolean;
}

export async function createTeam(
	session: Session,
	input: CreateTeamInput,
	callerAuth: CallerAuth = {},
): Promise<TeamsDoc> {
	const teamId =
		input.teamId && input.teamId !== "unique()"
			? input.teamId
			: ID.custom(ID.unique());

	const existing = await session.getDocument("teams", teamId);
	if (!existing.empty()) {
		throw new ConflictError("Team already exists", {
			code: "team_already_exists",
		});
	}

	const isUserCaller = !callerAuth.isPrivileged && Boolean(callerAuth.userId);
	const initialTotal = isUserCaller ? 1 : 0;
	const search = [teamId, input.name].join(" ");
	const permissions = [
		Permission.update(Role.team(teamId, "owner")).toString(),
		Permission.delete(Role.team(teamId, "owner")).toString(),
	];

	const teamDoc = await session.createDocument(
		"teams",
		new Doc<Teams>({
			$id: teamId,
			name: input.name,
			total: initialTotal,
			prefs: {},
			search,
			$permissions: permissions,
		}),
	);

	if (isUserCaller && callerAuth.userId) {
		const roles = input.roles ? [...input.roles] : [];
		if (!roles.includes("owner")) {
			roles.push("owner");
		}

		const now = new Date().toISOString();
		await session.createDocument(
			"memberships",
			new Doc<Memberships>({
				$id: ID.unique(),
				userId: callerAuth.userId,
				teamId,
				roles,
				invited: now,
				joined: now,
				confirm: true,
				search: [callerAuth.userId, teamId].join(" "),
				$permissions: [
					Permission.delete(Role.user(callerAuth.userId)).toString(),
					Permission.update(Role.team(teamId, "owner")).toString(),
				],
			}),
		);
	}

	return teamDoc;
}

export async function getTeamOrThrow(
	session: Session,
	teamId: string,
): Promise<TeamsDoc> {
	const team = await session.getDocument("teams", teamId);
	if (team.empty()) {
		throw new NotFoundError("Team not found", { code: "team_not_found" });
	}
	return team;
}

export async function listTeams(
	session: Session,
	options: {
		queries?: Query[];
		search?: string;
		limit?: number;
		offset?: number;
	} = {},
): Promise<{ teams: TeamsDoc[]; total: number }> {
	const limit = options.limit ?? 25;
	const offset = options.offset ?? 0;
	const filterQueries = [...(options.queries ?? [])];

	if (options.search) {
		filterQueries.push(Query.search("search", options.search));
	}

	const paginatedQueries = [
		...filterQueries,
		Query.limit(limit),
		Query.offset(offset),
	];

	const [teams, total] = await Promise.all([
		session.find("teams", paginatedQueries),
		session.count("teams", filterQueries),
	]);

	return { teams, total };
}

export async function updateTeamName(
	session: Session,
	teamId: string,
	name: string,
): Promise<TeamsDoc> {
	await getTeamOrThrow(session, teamId);
	const search = [teamId, name].join(" ");

	return session.updateDocument(
		"teams",
		teamId,
		new Doc<Teams>({
			name,
			search,
		}),
	);
}

export async function deleteTeam(
	session: Session,
	teamId: string,
): Promise<void> {
	await getTeamOrThrow(session, teamId);

	// Cascade delete memberships
	try {
		await session.deleteDocuments("memberships", [
			Query.equal("teamId", [teamId]),
		]);
	} catch {
		// Ignore if memberships cleanup fails
	}

	await session.deleteDocument("teams", teamId);
}

export async function getTeamPrefs(
	session: Session,
	teamId: string,
): Promise<Record<string, unknown>> {
	const team = await getTeamOrThrow(session, teamId);
	return (team.get("prefs") ?? {}) as Record<string, unknown>;
}

export async function replaceTeamPrefs(
	session: Session,
	teamId: string,
	prefs: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	await getTeamOrThrow(session, teamId);

	await session.updateDocument("teams", teamId, new Doc<Teams>({ prefs }));

	return prefs;
}
