/**
 * Password quality validators — D42 project-level settings.
 *
 * Two optional checks, both configurable per project:
 * 1. **Password history** (`passwordHistory > 0`): rejects a new password
 *    that matches any of the last N stored hashes.
 * 2. **Personal data check** (`personalDataCheck`): rejects a password
 *    containing the user's id, email local part, name, or phone.
 *
 * Both are called on every password-write path: account creation,
 * self-service password update, admin password reset, and recovery.
 * (v2 fix: v1 skipped the personal-data check on recovery.)
 */

import { verifyPassword } from "./password";

export interface PersonalData {
	userId?: string;
	email?: string;
	name?: string;
	phone?: string;
}

/**
 * Check whether `password` matches any hash in the user's password history.
 *
 * `history` is the array of previous hashes (most recent first). Only the
 * first `maxHistory` entries are checked — the project's
 * `auths.passwordHistory` setting.
 *
 * Returns `true` if the password was recently used (i.e. should be rejected).
 */
export async function isPasswordRecentlyUsed(
	password: string,
	history: string[],
	maxHistory: number,
): Promise<boolean> {
	if (maxHistory <= 0 || history.length === 0) return false;

	const toCheck = history.slice(0, maxHistory);
	for (const hash of toCheck) {
		if (await verifyPassword(password, hash)) return true;
	}
	return false;
}

/**
 * Check whether `password` contains personal data that makes it trivially
 * guessable. Checks are case-insensitive. Only non-empty, ≥3-char
 * fragments are checked (a 2-char name like "Li" would match too many
 * passwords by coincidence).
 *
 * Returns `true` if personal data is found (i.e. should be rejected).
 */
export function containsPersonalData(
	password: string,
	data: PersonalData,
): boolean {
	const lower = password.toLowerCase();
	const fragments: string[] = [];

	if (data.userId) fragments.push(data.userId);
	if (data.email) {
		// Check the local part (before @), not the domain.
		const localPart = data.email.split("@")[0];
		if (localPart) fragments.push(localPart);
	}
	if (data.name) {
		// Check each name part (first, last, etc.) individually.
		for (const part of data.name.split(/\s+/)) {
			if (part) fragments.push(part);
		}
	}
	if (data.phone) {
		// Strip leading + and any non-digit chars, then check the numeric part.
		const digits = data.phone.replace(/\D/g, "");
		if (digits) fragments.push(digits);
	}

	for (const fragment of fragments) {
		if (fragment.length >= 3 && lower.includes(fragment.toLowerCase())) {
			return true;
		}
	}

	return false;
}
