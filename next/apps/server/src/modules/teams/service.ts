import type { Query, Session } from "@nuvix/db";
import type { MembershipsDoc } from "../../types/generated";
import {
	formatMembership,
	formatTeam,
	type MembershipContext,
	type MembershipView,
	type TeamView,
} from "./formatter";
import {
	acceptInvite,
	deleteMembership,
	getMembershipOrThrow,
	type InviteMemberInput,
	inviteMember,
	listMemberships,
	updateMembershipRoles,
} from "./operations/memberships";
import {
	type CallerAuth,
	type CreateTeamInput,
	createTeam,
	deleteTeam,
	getTeamOrThrow,
	getTeamPrefs,
	listTeams,
	replaceTeamPrefs,
	updateTeamName,
} from "./operations/teams";

export interface ListTeamsOptions {
	queries?: Query[];
	search?: string;
	limit?: number;
	offset?: number;
}

export interface ListMembershipsOptions {
	queries?: Query[];
	search?: string;
	limit?: number;
	offset?: number;
}

export class TeamsService {
	constructor(private readonly session: Session) {}

	async create(
		input: CreateTeamInput,
		callerAuth: CallerAuth = {},
	): Promise<TeamView> {
		const team = await createTeam(this.session, input, callerAuth);
		return formatTeam(team);
	}

	async get(teamId: string): Promise<TeamView> {
		const team = await getTeamOrThrow(this.session, teamId);
		return formatTeam(team);
	}

	async list(
		options: ListTeamsOptions = {},
	): Promise<{ teams: TeamView[]; total: number }> {
		const { teams, total } = await listTeams(this.session, options);
		return {
			teams: teams.map(formatTeam),
			total,
		};
	}

	async update(teamId: string, input: { name: string }): Promise<TeamView> {
		const team = await updateTeamName(this.session, teamId, input.name);
		return formatTeam(team);
	}

	async delete(teamId: string): Promise<void> {
		return deleteTeam(this.session, teamId);
	}

	async getPrefs(teamId: string): Promise<Record<string, unknown>> {
		return getTeamPrefs(this.session, teamId);
	}

	async updatePrefs(
		teamId: string,
		prefs: Record<string, unknown>,
	): Promise<Record<string, unknown>> {
		return replaceTeamPrefs(this.session, teamId, prefs);
	}

	// Membership operations

	private async enrichMembership(
		membership: MembershipsDoc,
		confirmUrl?: string,
	): Promise<MembershipView> {
		const userId = membership.get("userId");
		const teamId = membership.get("teamId");

		const [user, team] = await Promise.all([
			this.session.getDocument("users", userId),
			this.session.getDocument("teams", teamId),
		]);

		const context: MembershipContext = {
			userName: user.empty() ? "" : (user.get("name") ?? ""),
			userEmail: user.empty() ? "" : (user.get("email") ?? ""),
			teamName: team.empty() ? "" : (team.get("name") ?? ""),
			mfa: user.empty() ? false : Boolean(user.get("mfa")),
			confirmUrl,
		};

		return formatMembership(membership, context);
	}

	async inviteMember(
		teamId: string,
		input: InviteMemberInput,
		callerAuth: CallerAuth = {},
	): Promise<MembershipView> {
		const { membership, confirmUrl } = await inviteMember(
			this.session,
			teamId,
			input,
			callerAuth,
		);
		return this.enrichMembership(membership, confirmUrl);
	}

	async getMembership(
		teamId: string,
		membershipId: string,
	): Promise<MembershipView> {
		const membership = await getMembershipOrThrow(
			this.session,
			teamId,
			membershipId,
		);
		return this.enrichMembership(membership);
	}

	async listMemberships(
		teamId: string,
		options: ListMembershipsOptions = {},
	): Promise<{ memberships: MembershipView[]; total: number }> {
		const { memberships, total } = await listMemberships(
			this.session,
			teamId,
			options,
		);

		const enriched = await Promise.all(
			memberships.map((m) => this.enrichMembership(m)),
		);

		return {
			memberships: enriched,
			total,
		};
	}

	async updateMembershipRoles(
		teamId: string,
		membershipId: string,
		roles: string[],
		callerAuth: CallerAuth = {},
	): Promise<MembershipView> {
		const membership = await updateMembershipRoles(
			this.session,
			teamId,
			membershipId,
			roles,
			callerAuth,
		);
		return this.enrichMembership(membership);
	}

	async acceptInvite(
		teamId: string,
		membershipId: string,
		input: { userId: string; secret: string },
	): Promise<MembershipView> {
		const membership = await acceptInvite(
			this.session,
			teamId,
			membershipId,
			input,
		);
		return this.enrichMembership(membership);
	}

	async deleteMembership(
		teamId: string,
		membershipId: string,
		callerAuth: CallerAuth = {},
	): Promise<void> {
		return deleteMembership(this.session, teamId, membershipId, callerAuth);
	}
}
