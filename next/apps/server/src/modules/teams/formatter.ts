import type { MembershipsDoc, TeamsDoc } from "../../types/generated";

export interface TeamView {
	$id: string;
	$permissions: string[];
	name: string;
	total: number;
	prefs: Record<string, unknown>;
	$createdAt?: string;
	$updatedAt?: string;
}

export interface MembershipView {
	$id: string;
	$permissions: string[];
	userId: string;
	userName: string;
	userEmail: string;
	teamId: string;
	teamName: string;
	roles: string[];
	status: "invited" | "accepted";
	invited: string;
	joined: string | null;
	mfa: boolean;
	confirmUrl?: string;
	$createdAt?: string;
	$updatedAt?: string;
}

export function formatTeam(team: TeamsDoc): TeamView {
	const createdAt = team.get("$createdAt");
	const updatedAt = team.get("$updatedAt");
	const permissions = (team.get("$permissions") ?? []) as string[];

	return {
		$id: team.getId(),
		$permissions: permissions,
		name: team.get("name"),
		total: team.get("total") ?? 0,
		prefs: (team.get("prefs") ?? {}) as Record<string, unknown>,
		$createdAt: createdAt ? String(createdAt) : undefined,
		$updatedAt: updatedAt ? String(updatedAt) : undefined,
	};
}

export interface MembershipContext {
	userName?: string;
	userEmail?: string;
	teamName?: string;
	mfa?: boolean;
	confirmUrl?: string;
}

export function formatMembership(
	membership: MembershipsDoc,
	context: MembershipContext = {},
): MembershipView {
	const createdAt = membership.get("$createdAt");
	const updatedAt = membership.get("$updatedAt");
	const permissions = (membership.get("$permissions") ?? []) as string[];
	const confirm = Boolean(membership.get("confirm"));
	const invited = membership.get("invited");
	const joined = membership.get("joined");

	return {
		$id: membership.getId(),
		$permissions: permissions,
		userId: membership.get("userId"),
		userName: context.userName ?? "",
		userEmail: context.userEmail ?? "",
		teamId: membership.get("teamId"),
		teamName: context.teamName ?? "",
		roles: (membership.get("roles") ?? []) as string[],
		status: confirm ? "accepted" : "invited",
		invited: invited ? String(invited) : "",
		joined: joined ? String(joined) : null,
		mfa: context.mfa ?? false,
		confirmUrl: context.confirmUrl,
		$createdAt: createdAt ? String(createdAt) : undefined,
		$updatedAt: updatedAt ? String(updatedAt) : undefined,
	};
}
