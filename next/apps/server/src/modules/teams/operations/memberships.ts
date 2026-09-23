import { Auth, generateSecret } from "@nuvix/core/auth";
import { Doc, ID, Query, type Session } from "@nuvix/db";
import {
	BadRequestError,
	ConflictError,
	NotFoundError,
	UnauthorizedError,
} from "../../../shared/errors";
import type {
	Memberships,
	MembershipsDoc,
	Teams,
	Users,
} from "../../../types/generated";
import type { CallerAuth } from "./teams";
import { getTeamOrThrow } from "./teams";

export interface InviteMemberInput {
	userId?: string;
	email?: string;
	phone?: string;
	roles: string[];
	url?: string;
}

export async function inviteMember(
	session: Session,
	teamId: string,
	input: InviteMemberInput,
	callerAuth: CallerAuth = {},
): Promise<{ membership: MembershipsDoc; confirmUrl?: string }> {
	if (!input.email && !input.userId && !input.phone) {
		throw new BadRequestError(
			"At least one of email, userId, or phone is required",
			{ code: "user_identifier_missing" },
		);
	}

	const team = await getTeamOrThrow(session, teamId);

	// Check caller authorization: must be owner or privileged
	if (!callerAuth.isPrivileged) {
		if (!callerAuth.userId) {
			throw new UnauthorizedError("Authentication required", {
				code: "user_unauthorized",
			});
		}

		const callerMemberships = await session.find("memberships", [
			Query.equal("teamId", [teamId]),
			Query.equal("userId", [callerAuth.userId]),
			Query.equal("confirm", [true]),
		]);

		const isOwner = callerMemberships.some((m) => {
			const roles = (m.get("roles") ?? []) as string[];
			return roles.includes("owner");
		});

		if (!isOwner) {
			throw new UnauthorizedError(
				"Must be an owner of this team to invite members",
				{ code: "user_unauthorized" },
			);
		}

		if (!input.url) {
			throw new BadRequestError("URL is required for invite", {
				code: "general_argument_invalid",
			});
		}
	}

	// Resolve target user
	let targetUserId = input.userId;

	if (input.userId) {
		const user = await session.getDocument("users", input.userId);
		if (user.empty()) {
			throw new NotFoundError("User not found", { code: "user_not_found" });
		}
		if (input.email && user.get("email") && user.get("email") !== input.email) {
			throw new ConflictError("User already exists with different email", {
				code: "user_already_exists",
			});
		}
		if (input.phone && user.get("phone") && user.get("phone") !== input.phone) {
			throw new ConflictError("User already exists with different phone", {
				code: "user_already_exists",
			});
		}
	} else if (input.email) {
		const existing = await session.findOne("users", [
			Query.equal("email", [input.email]),
		]);
		if (!existing.empty()) {
			targetUserId = existing.getId();
		} else {
			// Auto-provision unverified user account
			const newId = ID.custom(ID.unique());
			const now = new Date().toISOString();
			const created = await session.createDocument(
				"users",
				new Doc<Users>({
					$id: newId,
					email: input.email,
					name: input.email.split("@")[0] ?? "",
					phone: input.phone ?? "",
					status: true,
					emailVerification: false,
					phoneVerification: false,
					mfa: false,
					labels: [],
					passwordHistory: [],
					registration: now,
					accessedAt: now,
					prefs: {},
					search: [newId, input.email].join(" "),
				}),
			);
			targetUserId = created.getId();
		}
	} else if (input.phone) {
		const existing = await session.findOne("users", [
			Query.equal("phone", [input.phone]),
		]);
		if (!existing.empty()) {
			targetUserId = existing.getId();
		} else {
			const newId = ID.custom(ID.unique());
			const now = new Date().toISOString();
			const created = await session.createDocument(
				"users",
				new Doc<Users>({
					$id: newId,
					phone: input.phone,
					status: true,
					emailVerification: false,
					phoneVerification: false,
					mfa: false,
					labels: [],
					passwordHistory: [],
					registration: now,
					accessedAt: now,
					prefs: {},
					search: [newId, input.phone].join(" "),
				}),
			);
			targetUserId = created.getId();
		}
	}

	if (!targetUserId) {
		throw new BadRequestError("Unable to resolve user for invite", {
			code: "user_not_found",
		});
	}

	// Check if already invited or a member
	const existingMembership = await session.findOne("memberships", [
		Query.equal("teamId", [teamId]),
		Query.equal("userId", [targetUserId]),
	]);

	if (!existingMembership.empty()) {
		throw new ConflictError(
			"User is already invited or a member of this team",
			{
				code: "team_invite_already_exists",
			},
		);
	}

	const membershipId = ID.unique();
	const now = new Date().toISOString();

	// Privileged instant-add shortcut
	if (callerAuth.isPrivileged) {
		const membership = await session.createDocument(
			"memberships",
			new Doc<Memberships>({
				$id: membershipId,
				userId: targetUserId,
				teamId,
				roles: input.roles,
				invited: now,
				joined: now,
				confirm: true,
				search: [membershipId, targetUserId].join(" "),
				$permissions: [
					`delete("user:${targetUserId}")`,
					`update("team:${teamId}/owner")`,
				],
			}),
		);

		const currentTotal = team.get("total") ?? 0;
		await session.updateDocument(
			"teams",
			teamId,
			new Doc<Teams>({ total: currentTotal + 1 }),
		);

		return { membership };
	}

	// Non-privileged invite flow with secret
	const secret = generateSecret();
	const secretHash = Auth.hash(secret);

	const membership = await session.createDocument(
		"memberships",
		new Doc<Memberships>({
			$id: membershipId,
			userId: targetUserId,
			teamId,
			roles: input.roles,
			invited: now,
			confirm: false,
			secretHash,
			search: [membershipId, targetUserId].join(" "),
			$permissions: [
				`delete("user:${targetUserId}")`,
				`update("team:${teamId}/owner")`,
			],
		}),
	);

	const confirmUrl = `${input.url}?teamId=${encodeURIComponent(
		teamId,
	)}&membershipId=${encodeURIComponent(
		membershipId,
	)}&userId=${encodeURIComponent(targetUserId)}&secret=${encodeURIComponent(
		secret,
	)}`;

	return { membership, confirmUrl };
}

export async function getMembershipOrThrow(
	session: Session,
	teamId: string,
	membershipId: string,
): Promise<MembershipsDoc> {
	const membership = await session.getDocument("memberships", membershipId);
	if (membership.empty()) {
		throw new NotFoundError("Membership not found", {
			code: "membership_not_found",
		});
	}
	if (membership.get("teamId") !== teamId) {
		throw new NotFoundError("Membership does not belong to this team", {
			code: "team_membership_mismatch",
		});
	}
	return membership;
}

export async function listMemberships(
	session: Session,
	teamId: string,
	options: {
		queries?: Query[];
		search?: string;
		limit?: number;
		offset?: number;
	} = {},
): Promise<{ memberships: MembershipsDoc[]; total: number }> {
	await getTeamOrThrow(session, teamId);

	const limit = options.limit ?? 25;
	const offset = options.offset ?? 0;
	const filterQueries = [
		Query.equal("teamId", [teamId]),
		...(options.queries ?? []),
	];

	if (options.search) {
		filterQueries.push(Query.search("search", options.search));
	}

	const paginatedQueries = [
		...filterQueries,
		Query.limit(limit),
		Query.offset(offset),
	];

	const [memberships, total] = await Promise.all([
		session.find("memberships", paginatedQueries),
		session.count("memberships", filterQueries),
	]);

	return { memberships, total };
}

export async function updateMembershipRoles(
	session: Session,
	teamId: string,
	membershipId: string,
	roles: string[],
	callerAuth: CallerAuth = {},
): Promise<MembershipsDoc> {
	const membership = await getMembershipOrThrow(session, teamId, membershipId);

	if (!callerAuth.isPrivileged) {
		if (!callerAuth.userId) {
			throw new UnauthorizedError("Authentication required", {
				code: "user_unauthorized",
			});
		}

		const callerMemberships = await session.find("memberships", [
			Query.equal("teamId", [teamId]),
			Query.equal("userId", [callerAuth.userId]),
			Query.equal("confirm", [true]),
		]);

		const isOwner = callerMemberships.some((m) => {
			const mRoles = (m.get("roles") ?? []) as string[];
			return mRoles.includes("owner");
		});

		if (!isOwner) {
			throw new UnauthorizedError(
				"Must be an owner of this team to update roles",
				{ code: "user_unauthorized" },
			);
		}
	}

	// Last-owner protection
	const currentRoles = (membership.get("roles") ?? []) as string[];
	const isOwner = currentRoles.includes("owner");
	const willBeOwner = roles.includes("owner");

	if (isOwner && !willBeOwner && membership.get("confirm")) {
		const confirmedMemberships = await session.find("memberships", [
			Query.equal("teamId", [teamId]),
			Query.equal("confirm", [true]),
		]);

		const ownerCount = confirmedMemberships.filter((m) => {
			const mRoles = (m.get("roles") ?? []) as string[];
			return mRoles.includes("owner");
		}).length;

		if (ownerCount <= 1) {
			throw new ConflictError("Cannot remove the last owner of a team", {
				code: "team_last_owner",
			});
		}
	}

	return session.updateDocument(
		"memberships",
		membershipId,
		new Doc<Memberships>({ roles }),
	);
}

export async function acceptInvite(
	session: Session,
	teamId: string,
	membershipId: string,
	input: { userId: string; secret: string },
): Promise<MembershipsDoc> {
	const membership = await getMembershipOrThrow(session, teamId, membershipId);

	if (membership.get("userId") !== input.userId) {
		throw new UnauthorizedError("Invite userId does not match", {
			code: "team_invite_mismatch",
		});
	}

	if (membership.get("confirm")) {
		throw new ConflictError("Membership is already confirmed", {
			code: "membership_already_confirmed",
		});
	}

	const secretHash = membership.get("secretHash");
	if (!secretHash || !Auth.verify(input.secret, secretHash)) {
		throw new UnauthorizedError("Invalid invite secret", {
			code: "team_invalid_secret",
		});
	}

	const now = new Date().toISOString();
	const updated = await session.updateDocument(
		"memberships",
		membershipId,
		new Doc<Memberships>({
			confirm: true,
			joined: now,
		}),
	);

	// Increment team total
	const team = await getTeamOrThrow(session, teamId);
	const currentTotal = team.get("total") ?? 0;
	await session.updateDocument(
		"teams",
		teamId,
		new Doc<Teams>({ total: currentTotal + 1 }),
	);

	// Set user's emailVerification flag to true
	try {
		await session.updateDocument(
			"users",
			input.userId,
			new Doc<Users>({ emailVerification: true }),
		);
	} catch {
		// Ignore if user doc update fails
	}

	return updated;
}

export async function deleteMembership(
	session: Session,
	teamId: string,
	membershipId: string,
	callerAuth: CallerAuth = {},
): Promise<void> {
	const membership = await getMembershipOrThrow(session, teamId, membershipId);

	if (!callerAuth.isPrivileged) {
		if (!callerAuth.userId) {
			throw new UnauthorizedError("Authentication required", {
				code: "user_unauthorized",
			});
		}

		const isSelf = callerAuth.userId === membership.get("userId");
		if (!isSelf) {
			const callerMemberships = await session.find("memberships", [
				Query.equal("teamId", [teamId]),
				Query.equal("userId", [callerAuth.userId]),
				Query.equal("confirm", [true]),
			]);

			const isOwner = callerMemberships.some((m) => {
				const roles = (m.get("roles") ?? []) as string[];
				return roles.includes("owner");
			});

			if (!isOwner) {
				throw new UnauthorizedError(
					"Insufficient permissions to delete membership",
					{ code: "user_unauthorized" },
				);
			}
		}
	}

	// Last-owner protection
	const roles = (membership.get("roles") ?? []) as string[];
	if (roles.includes("owner") && membership.get("confirm")) {
		const confirmedMemberships = await session.find("memberships", [
			Query.equal("teamId", [teamId]),
			Query.equal("confirm", [true]),
		]);

		const ownerCount = confirmedMemberships.filter((m) => {
			const mRoles = (m.get("roles") ?? []) as string[];
			return mRoles.includes("owner");
		}).length;

		if (ownerCount <= 1) {
			throw new ConflictError("Cannot remove the last owner of a team", {
				code: "team_last_owner",
			});
		}
	}

	await session.deleteDocument("memberships", membershipId);

	// Decrement team total if membership was confirmed
	if (membership.get("confirm")) {
		try {
			const team = await getTeamOrThrow(session, teamId);
			const currentTotal = team.get("total") ?? 0;
			const nextTotal = Math.max(0, currentTotal - 1);
			await session.updateDocument(
				"teams",
				teamId,
				new Doc<Teams>({ total: nextTotal }),
			);
		} catch {
			// Ignore if team total update fails
		}
	}
}
