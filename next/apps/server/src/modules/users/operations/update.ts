import {
	containsPersonalData,
	hashPassword,
	isPasswordRecentlyUsed,
} from "@nuvix/core/auth";
import { Doc, ID, Query, type Session } from "@nuvix/db";
import {
	BadRequestError,
	ConflictError,
	NotFoundError,
} from "../../../shared/errors";
import type {
	Targets,
	TargetsDoc,
	Users,
	UsersDoc,
} from "../../../types/generated";

export async function getUserOrThrow(
	session: Session,
	userId: string,
): Promise<UsersDoc> {
	const user = await session.getDocument("users", userId);
	if (user.empty()) {
		throw new NotFoundError("User not found", { code: "user_not_found" });
	}
	return user;
}

export async function updateUserName(
	session: Session,
	userId: string,
	name: string,
): Promise<UsersDoc> {
	const user = await getUserOrThrow(session, userId);
	const email = user.get("email") ?? "";
	const phone = user.get("phone") ?? "";
	const search = [userId, email, phone, name].filter(Boolean).join(" ");

	return session.updateDocument(
		"users",
		userId,
		new Doc<Users>({
			name,
			search,
		}),
	);
}

export async function updateUserPassword(
	session: Session,
	userId: string,
	password: string,
	options: {
		maxHistory?: number;
		personalDataCheck?: boolean;
	} = {},
): Promise<UsersDoc> {
	const user = await getUserOrThrow(session, userId);

	if (options.personalDataCheck) {
		const hasPersonalData = containsPersonalData(password, {
			userId,
			email: user.get("email"),
			phone: user.get("phone"),
			name: user.get("name"),
		});
		if (hasPersonalData) {
			throw new BadRequestError(
				"Password contains personal data and cannot be used",
				{ code: "password_personal_data" },
			);
		}
	}

	const currentHistory = (user.get("passwordHistory") ?? []) as string[];
	const currentPassword = user.get("password");
	const allHistory = currentPassword
		? [currentPassword, ...currentHistory]
		: currentHistory;

	if (options.maxHistory && options.maxHistory > 0) {
		const recentlyUsed = await isPasswordRecentlyUsed(
			password,
			allHistory,
			options.maxHistory,
		);
		if (recentlyUsed) {
			throw new BadRequestError(
				"Password was recently used and cannot be reused",
				{ code: "password_recently_used" },
			);
		}
	}

	const newHash = await hashPassword(password, { algorithm: "argon2id" });
	const maxStoredHistory = Math.max(0, options.maxHistory ?? 10);
	const nextHistory = allHistory.slice(0, maxStoredHistory);

	return session.updateDocument(
		"users",
		userId,
		new Doc<Users>({
			password: newHash,
			hash: "argon2id",
			passwordHistory: nextHistory,
			passwordUpdate: new Date().toISOString(),
		}),
	);
}

export async function updateUserEmail(
	session: Session,
	userId: string,
	email: string,
): Promise<{ user: UsersDoc; targets: TargetsDoc[] }> {
	const user = await getUserOrThrow(session, userId);

	if (user.get("email") !== email) {
		const existing = await session.findOne("users", [
			Query.equal("email", [email]),
		]);
		if (!existing.empty() && existing.getId() !== userId) {
			throw new ConflictError("User with this email already exists", {
				code: "user_email_already_exists",
			});
		}
	}

	const search = [
		userId,
		email,
		user.get("phone") ?? "",
		user.get("name") ?? "",
	]
		.filter(Boolean)
		.join(" ");

	const updatedUser = await session.updateDocument(
		"users",
		userId,
		new Doc<Users>({
			email,
			emailVerification: false,
			search,
		}),
	);

	const emailTargets = await session.find("targets", [
		Query.equal("userId", [userId]),
		Query.equal("providerType", ["email"]),
	]);

	if (emailTargets.length > 0) {
		const target = emailTargets[0];
		if (target) {
			await session.updateDocument(
				"targets",
				target.getId(),
				new Doc<Targets>({
					identifier: email,
				}),
			);
		}
	} else {
		await session.createDocument(
			"targets",
			new Doc<Targets>({
				$id: ID.unique(),
				userId,
				providerType: "email",
				identifier: email,
				name: user.get("name") ?? "",
				expired: false,
			}),
		);
	}

	const targets = await session.find("targets", [
		Query.equal("userId", [userId]),
	]);

	return { user: updatedUser, targets };
}

export async function updateUserPhone(
	session: Session,
	userId: string,
	phone: string,
): Promise<{ user: UsersDoc; targets: TargetsDoc[] }> {
	const user = await getUserOrThrow(session, userId);

	if (user.get("phone") !== phone) {
		const existing = await session.findOne("users", [
			Query.equal("phone", [phone]),
		]);
		if (!existing.empty() && existing.getId() !== userId) {
			throw new ConflictError("User with this phone already exists", {
				code: "user_phone_already_exists",
			});
		}
	}

	const search = [
		userId,
		user.get("email") ?? "",
		phone,
		user.get("name") ?? "",
	]
		.filter(Boolean)
		.join(" ");

	const updatedUser = await session.updateDocument(
		"users",
		userId,
		new Doc<Users>({
			phone,
			phoneVerification: false,
			search,
		}),
	);

	const phoneTargets = await session.find("targets", [
		Query.equal("userId", [userId]),
		Query.equal("providerType", ["sms"]),
	]);

	if (phoneTargets.length > 0) {
		const target = phoneTargets[0];
		if (target) {
			await session.updateDocument(
				"targets",
				target.getId(),
				new Doc<Targets>({
					identifier: phone,
				}),
			);
		}
	} else {
		await session.createDocument(
			"targets",
			new Doc<Targets>({
				$id: ID.unique(),
				userId,
				providerType: "sms",
				identifier: phone,
				name: user.get("name") ?? "",
				expired: false,
			}),
		);
	}

	const targets = await session.find("targets", [
		Query.equal("userId", [userId]),
	]);

	return { user: updatedUser, targets };
}

export async function updateUserVerification(
	session: Session,
	userId: string,
	emailVerification: boolean,
): Promise<UsersDoc> {
	await getUserOrThrow(session, userId);
	return session.updateDocument(
		"users",
		userId,
		new Doc<Users>({ emailVerification }),
	);
}

export async function updateUserPhoneVerification(
	session: Session,
	userId: string,
	phoneVerification: boolean,
): Promise<UsersDoc> {
	await getUserOrThrow(session, userId);
	return session.updateDocument(
		"users",
		userId,
		new Doc<Users>({ phoneVerification }),
	);
}

export async function updateUserPrefs(
	session: Session,
	userId: string,
	prefs: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	const user = await getUserOrThrow(session, userId);
	const existing = (user.get("prefs") ?? {}) as Record<string, unknown>;
	const merged = { ...existing, ...prefs };

	await session.updateDocument(
		"users",
		userId,
		new Doc<Users>({ prefs: merged }),
	);

	return merged;
}

export async function updateUserLabels(
	session: Session,
	userId: string,
	labels: string[],
): Promise<UsersDoc> {
	await getUserOrThrow(session, userId);
	return session.updateDocument("users", userId, new Doc<Users>({ labels }));
}

export async function updateUserStatus(
	session: Session,
	userId: string,
	status: boolean,
): Promise<UsersDoc> {
	await getUserOrThrow(session, userId);
	return session.updateDocument("users", userId, new Doc<Users>({ status }));
}
