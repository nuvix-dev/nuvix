import { describe, expect, it, mock } from "bun:test";
import { hashPassword } from "@nuvix/core/auth";
import { Doc, type Session } from "@nuvix/db";
import {
	BadRequestError,
	ConflictError,
	NotFoundError,
} from "../../shared/errors";
import { UserService } from "./service";

describe("UserService", () => {
	it("creates a user successfully with email and phone", async () => {
		const createdDocs: Doc<Record<string, unknown>>[] = [];
		const mockSession = {
			findOne: mock(() => Promise.resolve(new Doc({}))),
			createDocument: mock(
				(_collectionId: string, doc: Doc<Record<string, unknown>>) => {
					createdDocs.push(doc);
					return Promise.resolve(doc);
				},
			),
		} as unknown as Session;

		const service = new UserService(mockSession);
		const result = await service.create({
			email: "test@example.com",
			phone: "+15550001234",
			password: "password123",
			name: "Test User",
		});

		expect(result.email).toBe("test@example.com");
		expect(result.phone).toBe("+15550001234");
		expect(result.name).toBe("Test User");
		expect(result.targets.length).toBe(2);
		expect(createdDocs.length).toBe(3); // users doc + email target + phone target
	});

	it("rejects creation if neither email nor phone is provided", async () => {
		const mockSession = {} as unknown as Session;
		const service = new UserService(mockSession);

		await expect(service.create({ name: "No Contact Info" })).rejects.toThrow(
			BadRequestError,
		);
	});

	it("throws conflict error if email already exists", async () => {
		const mockSession = {
			findOne: mock(() =>
				Promise.resolve(
					new Doc({ $id: "existing_1", email: "taken@example.com" }),
				),
			),
		} as unknown as Session;

		const service = new UserService(mockSession);
		await expect(
			service.create({ email: "taken@example.com" }),
		).rejects.toThrow(ConflictError);
	});

	it("creates a user with pre-hashed argon2 password", async () => {
		const mockSession = {
			findOne: mock(() => Promise.resolve(new Doc({}))),
			createDocument: mock(
				(_collectionId: string, doc: Doc<Record<string, unknown>>) =>
					Promise.resolve(doc),
			),
		} as unknown as Session;

		const service = new UserService(mockSession);
		const result = await service.createArgon2({
			email: "argon@example.com",
			password: "$argon2id$v=19$m=65536,t=3,p=4$dummy$dummy",
			hashOptions: { memoryCost: 65536, timeCost: 3 },
		});

		expect(result.email).toBe("argon@example.com");
		expect(result.hash).toBe("argon2id");
	});

	it("creates a user with pre-hashed bcrypt password", async () => {
		const mockSession = {
			findOne: mock(() => Promise.resolve(new Doc({}))),
			createDocument: mock(
				(_collectionId: string, doc: Doc<Record<string, unknown>>) =>
					Promise.resolve(doc),
			),
		} as unknown as Session;

		const service = new UserService(mockSession);
		const result = await service.createBcrypt({
			phone: "+15559998877",
			password: "$2a$12$dummyhashdummyhashdummyhashdummy",
		});

		expect(result.phone).toBe("+15559998877");
		expect(result.hash).toBe("bcrypt");
	});

	it("gets a user by id with targets", async () => {
		const mockSession = {
			getDocument: mock(() =>
				Promise.resolve(
					new Doc({
						$id: "user_100",
						name: "Ada Lovelace",
						email: "ada@example.com",
					}),
				),
			),
			find: mock(() =>
				Promise.resolve([
					new Doc({
						$id: "target_1",
						providerType: "email",
						identifier: "ada@example.com",
					}),
				]),
			),
		} as unknown as Session;

		const service = new UserService(mockSession);
		const user = await service.get("user_100");

		expect(user.$id).toBe("user_100");
		expect(user.name).toBe("Ada Lovelace");
		expect(user.targets.length).toBe(1);
	});

	it("throws NotFoundError when getting non-existent user", async () => {
		const mockSession = {
			getDocument: mock(() => Promise.resolve(new Doc({}))),
		} as unknown as Session;

		const service = new UserService(mockSession);
		await expect(service.get("user_unknown")).rejects.toThrow(NotFoundError);
	});

	it("lists users with pagination and count", async () => {
		const mockSession = {
			find: mock(() =>
				Promise.resolve([
					new Doc({ $id: "u1", name: "User 1" }),
					new Doc({ $id: "u2", name: "User 2" }),
				]),
			),
			count: mock(() => Promise.resolve(42)),
		} as unknown as Session;

		const service = new UserService(mockSession);
		const result = await service.list({ limit: 10, offset: 0, search: "User" });

		expect(result.users.length).toBe(2);
		expect(result.total).toBe(42);
		expect(result.users[0]?.targets).toEqual([]); // targets omitted on list
	});

	it("updates user profile name", async () => {
		const mockSession = {
			getDocument: mock(() =>
				Promise.resolve(
					new Doc({ $id: "u1", name: "Old Name", email: "u1@test.com" }),
				),
			),
			updateDocument: mock(
				(_col: string, _id: string, doc: Doc<Record<string, unknown>>) =>
					Promise.resolve(
						new Doc({
							$id: "u1",
							name: doc.get("name"),
							email: "u1@test.com",
						}),
					),
			),
			find: mock(() => Promise.resolve([])),
		} as unknown as Session;

		const service = new UserService(mockSession);
		const result = await service.updateName("u1", "New Name");

		expect(result.name).toBe("New Name");
	});

	it("updates user password and enforces password history", async () => {
		const existingHash = await hashPassword("oldPassword123");
		let updatedDoc: Doc<Record<string, unknown>> = new Doc({});
		const mockSession = {
			getDocument: mock(() =>
				Promise.resolve(
					new Doc({
						$id: "u1",
						email: "u1@test.com",
						password: existingHash,
						passwordHistory: [],
					}),
				),
			),
			updateDocument: mock(
				(_col: string, _id: string, doc: Doc<Record<string, unknown>>) => {
					updatedDoc = doc;
					return Promise.resolve(doc);
				},
			),
			find: mock(() => Promise.resolve([])),
		} as unknown as Session;

		const service = new UserService(mockSession);
		await service.updatePassword("u1", "NewSecretPass123!", {
			personalDataCheck: true,
			maxHistory: 5,
		});

		expect(updatedDoc.get("password")).toBeDefined();
		expect(updatedDoc.get("passwordHistory")).toEqual([existingHash]);
	});

	it("rejects password containing personal data", async () => {
		const mockSession = {
			getDocument: mock(() =>
				Promise.resolve(
					new Doc({
						$id: "u1",
						email: "charlie@test.com",
						name: "Charlie",
					}),
				),
			),
		} as unknown as Session;

		const service = new UserService(mockSession);
		await expect(
			service.updatePassword("u1", "my-Charlie-pass123", {
				personalDataCheck: true,
			}),
		).rejects.toThrow(BadRequestError);
	});

	it("updates user email and synchronizes target", async () => {
		const mockSession = {
			getDocument: mock(() =>
				Promise.resolve(new Doc({ $id: "u1", email: "old@test.com" })),
			),
			findOne: mock(() => Promise.resolve(new Doc({}))),
			find: mock(() =>
				Promise.resolve([
					new Doc({
						$id: "t1",
						userId: "u1",
						providerType: "email",
						identifier: "old@test.com",
					}),
				]),
			),
			updateDocument: mock(
				(_col: string, _id: string, doc: Doc<Record<string, unknown>>) =>
					Promise.resolve(doc),
			),
		} as unknown as Session;

		const service = new UserService(mockSession);
		const result = await service.updateEmail("u1", "new@test.com");

		expect(result.email).toBe("new@test.com");
	});

	it("updates verification flags", async () => {
		const mockSession = {
			getDocument: mock(() => Promise.resolve(new Doc({ $id: "u1" }))),
			updateDocument: mock(
				(_col: string, _id: string, doc: Doc<Record<string, unknown>>) =>
					Promise.resolve(doc),
			),
			find: mock(() => Promise.resolve([])),
		} as unknown as Session;

		const service = new UserService(mockSession);
		const res1 = await service.updateVerification("u1", true);
		expect(res1.emailVerification).toBe(true);

		const res2 = await service.updatePhoneVerification("u1", true);
		expect(res2.phoneVerification).toBe(true);
	});

	it("gets and merges user preferences", async () => {
		const mockSession = {
			getDocument: mock(() =>
				Promise.resolve(
					new Doc({
						$id: "u1",
						prefs: { theme: "dark", lang: "en" },
					}),
				),
			),
			updateDocument: mock(
				(_col: string, _id: string, doc: Doc<Record<string, unknown>>) =>
					Promise.resolve(doc),
			),
		} as unknown as Session;

		const service = new UserService(mockSession);
		const initialPrefs = await service.getPrefs("u1");
		expect(initialPrefs).toEqual({ theme: "dark", lang: "en" });

		const mergedPrefs = await service.updatePrefs("u1", {
			theme: "light",
			notifications: true,
		});
		expect(mergedPrefs).toEqual({
			theme: "light",
			lang: "en",
			notifications: true,
		});
	});

	it("updates user labels and status", async () => {
		const mockSession = {
			getDocument: mock(() => Promise.resolve(new Doc({ $id: "u1" }))),
			updateDocument: mock(
				(_col: string, _id: string, doc: Doc<Record<string, unknown>>) =>
					Promise.resolve(doc),
			),
			find: mock(() => Promise.resolve([])),
		} as unknown as Session;

		const service = new UserService(mockSession);
		const labelsRes = await service.updateLabels("u1", ["admin", "beta"]);
		expect(labelsRes.labels).toEqual(["admin", "beta"]);

		const statusRes = await service.updateStatus("u1", false);
		expect(statusRes.status).toBe(false);
	});

	it("deletes user and cascades cleanup", async () => {
		const deletedCollections: string[] = [];
		const mockSession = {
			getDocument: mock(() => Promise.resolve(new Doc({ $id: "u1" }))),
			deleteDocuments: mock((collectionId: string) => {
				deletedCollections.push(collectionId);
				return Promise.resolve(["id1"]);
			}),
			deleteDocument: mock((_collectionId: string, _id: string) =>
				Promise.resolve(true),
			),
		} as unknown as Session;

		const service = new UserService(mockSession);
		await service.delete("u1");

		expect(deletedCollections).toContain("sessions");
		expect(deletedCollections).toContain("targets");
		expect(deletedCollections).toContain("memberships");
		expect(deletedCollections).toContain("tokens");
		expect(mockSession.deleteDocument).toHaveBeenCalled();
	});
});
