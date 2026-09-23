import type { TargetsDoc, UsersDoc } from "../../types/generated";

export interface TargetView {
	$id: string;
	providerType: string;
	providerId: string;
	identifier: string;
	name: string;
	expired: boolean;
}

export interface UserView {
	$id: string;
	name: string;
	email: string;
	phone: string;
	status: boolean;
	labels: string[];
	passwordUpdate: string;
	registration: string;
	emailVerification: boolean;
	phoneVerification: boolean;
	mfa: boolean;
	prefs: Record<string, unknown>;
	accessedAt: string;
	hash?: string;
	hashOptions?: Record<string, unknown>;
	passwordHash?: string;
	targets: TargetView[];
	$createdAt?: string;
	$updatedAt?: string;
}

export function formatTarget(doc: TargetsDoc): TargetView {
	return {
		$id: doc.getId(),
		providerType: doc.get("providerType"),
		providerId: doc.get("providerId") ?? "",
		identifier: doc.get("identifier"),
		name: doc.get("name") ?? "",
		expired: doc.get("expired") ?? false,
	};
}

export function formatUser(
	user: UsersDoc,
	targets: TargetsDoc[] = [],
	options: { includePasswordHash?: boolean } = {},
): UserView {
	const createdAt = user.get("$createdAt");
	const updatedAt = user.get("$updatedAt");
	const password = user.get("password");
	const hash = user.get("hash");
	const hashOptions = user.get("hashOptions") as
		| Record<string, unknown>
		| undefined;

	return {
		$id: user.getId(),
		name: user.get("name") ?? "",
		email: user.get("email") ?? "",
		phone: user.get("phone") ?? "",
		status: user.get("status") ?? true,
		labels: (user.get("labels") ?? []) as string[],
		passwordUpdate:
			(user.get("passwordUpdate") as string | Date)?.toString() ?? "",
		registration: (user.get("registration") as string | Date)?.toString() ?? "",
		emailVerification: user.get("emailVerification") ?? false,
		phoneVerification: user.get("phoneVerification") ?? false,
		mfa: user.get("mfa") ?? false,
		prefs: (user.get("prefs") ?? {}) as Record<string, unknown>,
		accessedAt: (user.get("accessedAt") as string | Date)?.toString() ?? "",
		hash: hash ? String(hash) : undefined,
		hashOptions: hashOptions ?? undefined,
		passwordHash:
			options.includePasswordHash && password ? String(password) : undefined,
		targets: targets.map(formatTarget),
		$createdAt: createdAt ? String(createdAt) : undefined,
		$updatedAt: updatedAt ? String(updatedAt) : undefined,
	};
}
