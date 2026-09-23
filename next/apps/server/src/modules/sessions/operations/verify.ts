import { Auth } from "@nuvix/core/auth";
import { Query, type Session } from "@nuvix/db";

export interface VerifiedSession {
	sessionId: string;
	userId: string;
	factors: string[];
}

export async function verifySessionSecret(
	session: Session,
	secret: string,
): Promise<VerifiedSession | null> {
	if (!secret) return null;

	const secretHash = Auth.hash(secret);
	const sessionDoc = await session.findOne("sessions", [
		Query.equal("secretHash", [secretHash]),
	]);

	if (sessionDoc.empty()) {
		return null;
	}

	const expire = sessionDoc.get("expire");
	if (expire && new Date(expire).getTime() <= Date.now()) {
		return null;
	}

	const userId = sessionDoc.get("userId");
	const userDoc = await session.getDocument("users", userId);
	if (userDoc.empty() || userDoc.get("status") === false) {
		return null;
	}

	const factors = (sessionDoc.get("factors") ?? []) as string[];

	return {
		sessionId: sessionDoc.getId(),
		userId,
		factors,
	};
}
