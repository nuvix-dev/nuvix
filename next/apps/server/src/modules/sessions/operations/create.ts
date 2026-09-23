import { Auth, generateSecret } from "@nuvix/core/auth";
import { Doc, ID, Query, type Session } from "@nuvix/db";
import type { Sessions, SessionsDoc } from "../../../types/generated";

export interface RequestMetadata {
	ip?: string;
	userAgent?: string;
	countryCode?: string;
	osCode?: string;
	osName?: string;
	osVersion?: string;
	clientType?: string;
	clientCode?: string;
	clientName?: string;
	clientVersion?: string;
	clientEngine?: string;
	clientEngineVersion?: string;
	deviceName?: string;
	deviceBrand?: string;
	deviceModel?: string;
}

export interface SessionSettings {
	auths?: {
		duration?: number;
	};
	limits?: {
		userSessionsMax?: number;
		userSessionsDefault?: number;
	};
}

export async function createSession(
	session: Session,
	userId: string,
	provider: string,
	providerUid: string = "",
	factors: string[] = [provider],
	reqMeta: RequestMetadata = {},
	settings: SessionSettings = {},
): Promise<{ session: SessionsDoc; secret: string }> {
	const secret = generateSecret();
	const secretHash = Auth.hash(secret);

	const duration = settings.auths?.duration ?? 31536000;
	const expire = new Date(Date.now() + duration * 1000).toISOString();

	// Enforce session cap / LRU eviction (D23/D42)
	const softLimit = settings.limits?.userSessionsDefault ?? 10;
	const hardLimit = settings.limits?.userSessionsMax ?? 100;
	const cap = Math.min(softLimit, hardLimit);

	try {
		const existingSessions = await session.find("sessions", [
			Query.equal("userId", [userId]),
		]);

		if (existingSessions.length >= cap) {
			const toEvictCount = existingSessions.length - cap + 1;
			const sorted = [...existingSessions].sort((a, b) => {
				const aTime = new Date(a.get("expire") ?? 0).getTime();
				const bTime = new Date(b.get("expire") ?? 0).getTime();
				return aTime - bTime;
			});

			const toEvict = sorted.slice(0, toEvictCount);
			await Promise.all(
				toEvict.map((s) => session.deleteDocument("sessions", s.getId())),
			);
		}
	} catch {
		// Non-fatal if session listing fails
	}

	const sessionId = ID.unique();
	const permissions = [`delete("user:${userId}")`, `update("user:${userId}")`];

	const doc = await session.createDocument(
		"sessions",
		new Doc<Sessions>({
			$id: sessionId,
			userId,
			provider,
			providerUid,
			secretHash,
			ip: reqMeta.ip ?? "",
			userAgent: reqMeta.userAgent ?? "",
			countryCode: reqMeta.countryCode ?? "",
			osCode: reqMeta.osCode ?? "",
			osName: reqMeta.osName ?? "",
			osVersion: reqMeta.osVersion ?? "",
			clientType: reqMeta.clientType ?? "",
			clientCode: reqMeta.clientCode ?? "",
			clientName: reqMeta.clientName ?? "",
			clientVersion: reqMeta.clientVersion ?? "",
			clientEngine: reqMeta.clientEngine ?? "",
			clientEngineVersion: reqMeta.clientEngineVersion ?? "",
			deviceName: reqMeta.deviceName ?? "",
			deviceBrand: reqMeta.deviceBrand ?? "",
			deviceModel: reqMeta.deviceModel ?? "",
			factors,
			expire,
			$permissions: permissions,
		}),
	);

	return { session: doc, secret };
}
