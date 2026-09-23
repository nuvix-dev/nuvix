import { Query, type Session } from "@nuvix/db";
import { NotFoundError } from "../../../shared/errors";
import type { SessionsDoc } from "../../../types/generated";

export async function getSessionOrThrow(
	session: Session,
	sessionId: string,
): Promise<SessionsDoc> {
	const doc = await session.getDocument("sessions", sessionId);
	if (doc.empty()) {
		throw new NotFoundError("Session not found", { code: "user_session_not_found" });
	}
	return doc;
}

export async function listUserSessions(
	session: Session,
	userId: string,
): Promise<SessionsDoc[]> {
	return session.find("sessions", [Query.equal("userId", [userId])]);
}

export async function deleteSession(
	session: Session,
	sessionId: string,
): Promise<void> {
	await getSessionOrThrow(session, sessionId);
	await session.deleteDocument("sessions", sessionId);
}

export async function deleteAllUserSessions(
	session: Session,
	userId: string,
	exceptSessionId?: string,
): Promise<void> {
	const sessions = await listUserSessions(session, userId);
	const toDelete = exceptSessionId
		? sessions.filter((s) => s.getId() !== exceptSessionId)
		: sessions;

	await Promise.all(
		toDelete.map((s) => session.deleteDocument("sessions", s.getId())),
	);
}
