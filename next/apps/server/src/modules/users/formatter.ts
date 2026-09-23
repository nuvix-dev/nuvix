import type { TargetsDoc, UsersDoc } from "../../types/generated";

/**
 * Format a DB user document into the public API view (TargetResponse or UserResponse).
 * Note: Define these response interfaces if they don't exist yet in an api-contracts package,
 * or inline them here.
 */
export interface UserView {
	$id: string;
	name: string;
	email: string;
	phone: string;
	status: boolean;
	passwordUpdate: string;
	registration: string;
	emailVerification: boolean;
	phoneVerification: boolean;
	mfa: boolean;
	prefs: Record<string, unknown>;
	accessedAt: string;
	targets: TargetView[];
}

export interface TargetView {
	$id: string;
	providerType: string;
	providerId: string;
	identifier: string;
	name: string;
	expired: boolean;
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
): UserView {
	return {
		$id: user.getId(),
		name: user.get("name") ?? "",
		email: user.get("email") ?? "",
		phone: user.get("phone") ?? "",
		status: user.get("status") ?? true,
		passwordUpdate:
			(user.get("passwordUpdate") as string | Date)?.toString() ?? "",
		registration: (user.get("registration") as string | Date)?.toString() ?? "",
		emailVerification: user.get("emailVerification") ?? false,
		phoneVerification: user.get("phoneVerification") ?? false,
		mfa: user.get("mfa") ?? false,
		prefs: (user.get("prefs") ?? {}) as Record<string, unknown>,
		accessedAt: (user.get("accessedAt") as string | Date)?.toString() ?? "",
		targets: targets.map(formatTarget),
	};
}
