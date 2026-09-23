import { Query, type Session } from "@nuvix/db";
import { NotFoundError } from "../../../shared/errors";

export async function deleteUser(
	session: Session,
	userId: string,
): Promise<void> {
	const user = await session.getDocument("users", userId);
	if (user.empty()) {
		throw new NotFoundError("User not found", { code: "user_not_found" });
	}

	// Cascading deletes for related user collections
	const cascadeCollections = [
		"sessions",
		"tokens",
		"targets",
		"memberships",
		"identities",
		"authenticators",
		"challenges",
	] as const;

	await Promise.all(
		cascadeCollections.map(async (collection) => {
			try {
				await session.deleteDocuments(collection, [
					Query.equal("userId", [userId]),
				]);
			} catch {
				// Best-effort cleanup for optional collections
			}
		}),
	);

	await session.deleteDocument("users", userId);
}
