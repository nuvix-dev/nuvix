import { describe, expect, it, mock } from "bun:test";
import { Auth } from "@nuvix/core/auth";
import { Doc, type Session } from "@nuvix/db";
import {
	ConflictError,
	NotFoundError,
	UnauthorizedError,
} from "../../shared/errors";
import { TeamsService } from "./service";

describe("TeamsService", () => {
	describe("team CRUD", () => {
		it("creates a team for an ordinary user caller and auto-enrolls as owner", async () => {
			const createdDocs: Doc<Record<string, unknown>>[] = [];
			const mockSession = {
				getDocument: mock(() => Promise.resolve(new Doc({}))),
				createDocument: mock(
					(_col: string, doc: Doc<Record<string, unknown>>) => {
						createdDocs.push(doc);
						return Promise.resolve(doc);
					},
				),
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			const team = await service.create(
				{ name: "Designers", roles: ["designer"] },
				{ userId: "usr_alice", isPrivileged: false },
			);

			expect(team.name).toBe("Designers");
			expect(team.total).toBe(1);
			expect(createdDocs.length).toBe(2); // team doc + owner membership doc

			const membership = createdDocs[1];
			expect(membership?.get("userId")).toBe("usr_alice");
			const roles = (membership?.get("roles") ?? []) as string[];
			expect(roles).toContain("owner");
			expect(roles).toContain("designer");
		});

		it("creates a team for a privileged caller without auto-enrolling", async () => {
			const createdDocs: Doc<Record<string, unknown>>[] = [];
			const mockSession = {
				getDocument: mock(() => Promise.resolve(new Doc({}))),
				createDocument: mock(
					(_col: string, doc: Doc<Record<string, unknown>>) => {
						createdDocs.push(doc);
						return Promise.resolve(doc);
					},
				),
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			const team = await service.create(
				{ name: "Admins" },
				{ isPrivileged: true },
			);

			expect(team.name).toBe("Admins");
			expect(team.total).toBe(0);
			expect(createdDocs.length).toBe(1); // only team doc
		});

		it("throws conflict error if teamId already exists", async () => {
			const mockSession = {
				getDocument: mock(() =>
					Promise.resolve(new Doc({ $id: "team_existing", name: "Existing" })),
				),
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			await expect(
				service.create({ teamId: "team_existing", name: "Duplicate" }),
			).rejects.toThrow(ConflictError);
		});

		it("gets team by id", async () => {
			const mockSession = {
				getDocument: mock(() =>
					Promise.resolve(
						new Doc({ $id: "team_1", name: "Engineering", total: 5 }),
					),
				),
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			const team = await service.get("team_1");

			expect(team.$id).toBe("team_1");
			expect(team.name).toBe("Engineering");
			expect(team.total).toBe(5);
		});

		it("throws NotFoundError when team is not found", async () => {
			const mockSession = {
				getDocument: mock(() => Promise.resolve(new Doc({}))),
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			await expect(service.get("unknown_team")).rejects.toThrow(NotFoundError);
		});

		it("lists teams with pagination and total", async () => {
			const mockSession = {
				find: mock(() =>
					Promise.resolve([
						new Doc({ $id: "t1", name: "Team 1", total: 2 }),
						new Doc({ $id: "t2", name: "Team 2", total: 3 }),
					]),
				),
				count: mock(() => Promise.resolve(10)),
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			const result = await service.list({
				limit: 10,
				offset: 0,
				search: "Team",
			});

			expect(result.teams.length).toBe(2);
			expect(result.total).toBe(10);
		});

		it("updates team name", async () => {
			const mockSession = {
				getDocument: mock(() =>
					Promise.resolve(new Doc({ $id: "t1", name: "Old Name" })),
				),
				updateDocument: mock(
					(_col: string, _id: string, doc: Doc<Record<string, unknown>>) =>
						Promise.resolve(new Doc({ $id: "t1", name: doc.get("name") })),
				),
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			const updated = await service.update("t1", { name: "New Name" });

			expect(updated.name).toBe("New Name");
		});

		it("deletes team and cascades memberships", async () => {
			let deletedMembershipsCol = "";
			let deletedTeamId = "";

			const mockSession = {
				getDocument: mock(() =>
					Promise.resolve(new Doc({ $id: "t1", name: "Engineering" })),
				),
				deleteDocuments: mock((col: string) => {
					deletedMembershipsCol = col;
					return Promise.resolve(["m1", "m2"]);
				}),
				deleteDocument: mock((_col: string, id: string) => {
					deletedTeamId = id;
					return Promise.resolve(true);
				}),
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			await service.delete("t1");

			expect(deletedMembershipsCol).toBe("memberships");
			expect(deletedTeamId).toBe("t1");
		});

		it("gets and replaces team preferences wholesale", async () => {
			let replacedPrefs: Record<string, unknown> = {};
			const mockSession = {
				getDocument: mock(() =>
					Promise.resolve(
						new Doc({ $id: "t1", prefs: { color: "blue", active: true } }),
					),
				),
				updateDocument: mock(
					(_col: string, _id: string, doc: Doc<Record<string, unknown>>) => {
						replacedPrefs = doc.get("prefs") as Record<string, unknown>;
						return Promise.resolve(doc);
					},
				),
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			const prefs = await service.getPrefs("t1");
			expect(prefs).toEqual({ color: "blue", active: true });

			const updated = await service.updatePrefs("t1", { color: "red" });
			expect(updated).toEqual({ color: "red" });
			expect(replacedPrefs).toEqual({ color: "red" }); // wholesale replaced, not merged
		});
	});

	describe("memberships & invite lifecycle", () => {
		it("rejects invite if non-privileged caller is not an owner", async () => {
			const mockSession = {
				getDocument: mock(() =>
					Promise.resolve(new Doc({ $id: "t1", name: "Design" })),
				),
				find: mock(() => Promise.resolve([])), // caller has no owner membership
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			await expect(
				service.inviteMember(
					"t1",
					{
						email: "bob@example.com",
						roles: ["member"],
						url: "https://app.com",
					},
					{ userId: "usr_charlie", isPrivileged: false },
				),
			).rejects.toThrow(UnauthorizedError);
		});

		it("allows non-privileged owner to invite a member with secret and confirmUrl", async () => {
			let createdMembershipDoc: Doc<Record<string, unknown>> = new Doc({});
			const mockSession = {
				getDocument: mock((col: string, id: string) => {
					if (col === "teams") {
						return Promise.resolve(new Doc({ $id: id, name: "Design" }));
					}
					return Promise.resolve(new Doc({}));
				}),
				find: mock((col: string) => {
					if (col === "memberships") {
						return Promise.resolve([
							new Doc({
								$id: "m_caller",
								teamId: "t1",
								userId: "usr_alice",
								roles: ["owner"],
								confirm: true,
							}),
						]);
					}
					return Promise.resolve([]);
				}),
				findOne: mock(() => Promise.resolve(new Doc({}))), // user does not exist, auto-provision
				createDocument: mock(
					(col: string, doc: Doc<Record<string, unknown>>) => {
						if (col === "memberships") {
							createdMembershipDoc = doc;
						}
						return Promise.resolve(doc);
					},
				),
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			const result = await service.inviteMember(
				"t1",
				{
					email: "newmember@example.com",
					roles: ["editor"],
					url: "https://example.com/invite",
				},
				{ userId: "usr_alice", isPrivileged: false },
			);

			expect(result.status).toBe("invited");
			expect(result.confirmUrl).toBeDefined();
			expect(result.confirmUrl).toContain(
				"https://example.com/invite?teamId=t1",
			);
			expect(createdMembershipDoc.get("confirm")).toBe(false);
			expect(createdMembershipDoc.get("secretHash")).toBeDefined();
		});

		it("allows privileged caller to instantly add a confirmed member without secret", async () => {
			let createdMembershipDoc: Doc<Record<string, unknown>> = new Doc({});
			let updatedTeamDoc: Doc<Record<string, unknown>> = new Doc({});

			const mockSession = {
				getDocument: mock((col: string, id: string) => {
					if (col === "teams") {
						return Promise.resolve(
							new Doc({ $id: id, name: "Design", total: 2 }),
						);
					}
					return Promise.resolve(new Doc({}));
				}),
				findOne: mock(() => Promise.resolve(new Doc({}))),
				createDocument: mock(
					(col: string, doc: Doc<Record<string, unknown>>) => {
						if (col === "memberships") {
							createdMembershipDoc = doc;
						}
						return Promise.resolve(doc);
					},
				),
				updateDocument: mock(
					(_col: string, _id: string, doc: Doc<Record<string, unknown>>) => {
						updatedTeamDoc = doc;
						return Promise.resolve(doc);
					},
				),
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			const result = await service.inviteMember(
				"t1",
				{ email: "instant@example.com", roles: ["admin"] },
				{ isPrivileged: true },
			);

			expect(result.status).toBe("accepted");
			expect(result.confirmUrl).toBeUndefined();
			expect(createdMembershipDoc.get("confirm")).toBe(true);
			expect(updatedTeamDoc.get("total")).toBe(3);
		});

		it("accepts an invite with valid secret", async () => {
			const plainSecret = "super-secret-invite-token";
			const secretHash = Auth.hash(plainSecret);

			const mockMembership = new Doc({
				$id: "m_target",
				teamId: "t1",
				userId: "usr_invited",
				confirm: false,
				secretHash,
				roles: ["member"],
			});

			const mockSession = {
				getDocument: mock((col: string, id: string) => {
					if (col === "memberships") return Promise.resolve(mockMembership);
					if (col === "teams")
						return Promise.resolve(new Doc({ $id: id, total: 1 }));
					if (col === "users")
						return Promise.resolve(new Doc({ $id: id, name: "Invited User" }));
					return Promise.resolve(new Doc({}));
				}),
				updateDocument: mock(
					(_col: string, _id: string, doc: Doc<Record<string, unknown>>) =>
						Promise.resolve(
							new Doc({
								$id: "m_target",
								teamId: "t1",
								userId: "usr_invited",
								roles: ["member"],
								confirm: true,
								...doc,
							}),
						),
				),
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			const accepted = await service.acceptInvite("t1", "m_target", {
				userId: "usr_invited",
				secret: plainSecret,
			});

			expect(accepted.status).toBe("accepted");
		});

		it("rejects acceptInvite when secret does not match", async () => {
			const secretHash = Auth.hash("correct-secret");
			const mockMembership = new Doc({
				$id: "m_target",
				teamId: "t1",
				userId: "usr_invited",
				confirm: false,
				secretHash,
			});

			const mockSession = {
				getDocument: mock(() => Promise.resolve(mockMembership)),
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			await expect(
				service.acceptInvite("t1", "m_target", {
					userId: "usr_invited",
					secret: "wrong-secret",
				}),
			).rejects.toThrow(UnauthorizedError);
		});

		it("enforces last-owner protection when downgrading the last owner", async () => {
			const mockMembership = new Doc({
				$id: "m_owner",
				teamId: "t1",
				userId: "usr_only_owner",
				roles: ["owner"],
				confirm: true,
			});

			const mockSession = {
				getDocument: mock((col: string) => {
					if (col === "memberships") return Promise.resolve(mockMembership);
					return Promise.resolve(new Doc({}));
				}),
				find: mock((col: string) => {
					if (col === "memberships") {
						return Promise.resolve([mockMembership]); // only 1 owner
					}
					return Promise.resolve([]);
				}),
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			await expect(
				service.updateMembershipRoles(
					"t1",
					"m_owner",
					["member"], // removing owner role!
					{ isPrivileged: true },
				),
			).rejects.toThrow(ConflictError);
		});

		it("enforces last-owner protection when deleting the last owner", async () => {
			const mockMembership = new Doc({
				$id: "m_owner",
				teamId: "t1",
				userId: "usr_only_owner",
				roles: ["owner"],
				confirm: true,
			});

			const mockSession = {
				getDocument: mock((col: string) => {
					if (col === "memberships") return Promise.resolve(mockMembership);
					return Promise.resolve(new Doc({}));
				}),
				find: mock((col: string) => {
					if (col === "memberships") {
						return Promise.resolve([mockMembership]);
					}
					return Promise.resolve([]);
				}),
			} as unknown as Session;

			const service = new TeamsService(mockSession);
			await expect(
				service.deleteMembership("t1", "m_owner", {
					userId: "usr_only_owner",
					isPrivileged: false,
				}),
			).rejects.toThrow(ConflictError);
		});
	});
});
