import { describe, expect, it, mock } from "bun:test";
import { Doc, type Session } from "@nuvix/db";
import { ConflictError } from "../../shared/errors";
import { UserService } from "./service";

describe("UserService", () => {
	it("should create a user successfully", async () => {
		const mockSession = {
			findOne: mock(() => Promise.resolve(new Doc({}))),
			createDocument: mock(
				(collectionId: string, doc: Doc<Record<string, unknown>>) =>
					Promise.resolve(doc),
			),
		} as unknown as Session;

		const service = new UserService(mockSession);

		const result = await service.create({
			email: "test@example.com",
			password: "password123",
			name: "Test User",
		});

		expect(result.email).toBe("test@example.com");
		expect(result.name).toBe("Test User");
		expect(mockSession.createDocument).toHaveBeenCalled();
	});

	it("should throw conflict if email already exists", async () => {
		const mockSession = {
			findOne: mock(() =>
				Promise.resolve(
					new Doc({ $id: "existing", email: "test@example.com" }),
				),
			),
		} as unknown as Session;

		const service = new UserService(mockSession);

		await expect(service.create({ email: "test@example.com" })).rejects.toThrow(
			ConflictError,
		);
	});
});
