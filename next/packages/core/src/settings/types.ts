/**
 * Project-scoped configuration & limits (D42).
 *
 * Every feature gate and numeric limit is resolved from the calling project's
 * settings at request time, never hardcoded in service code.
 * See `docs/api/account.md` § "Project configuration & limits (D42)".
 */

export interface ProjectAuthSettings {
	/** Enable email/password signup and login. Default: true. */
	emailPassword: boolean;
	/** Enable anonymous sessions. Default: true. */
	anonymous: boolean;
	/** Enable magic URL tokens. Default: true. */
	magicUrl: boolean;
	/** Enable email OTP login. Default: true. */
	emailOtp: boolean;
	/** Enable phone SMS login (requires SMS provider). Default: false. */
	phone: boolean;
	/** Enable team invitations. Default: true. */
	invites: boolean;
	/** Default session lifetime in seconds. Default: 31536000 (1 year). */
	duration: number;
	/** Maximum total user count (0 = unlimited). Default: 0. */
	limit: number;
	/** Number of previous passwords to check against (0 = disabled). Default: 0. */
	passwordHistory: number;
	/** Check password for personal data (id, email, name, phone). Default: false. */
	personalDataCheck: boolean;
	/** Send email alert on new session login. Default: false. */
	sessionAlerts: boolean;
	/** Mock phone numbers that bypass real SMS dispatch in QA/testing. */
	mockNumbers: string[];
}

export interface ProjectLimitSettings {
	/** Hard cap on concurrent sessions per user. Default: 100. */
	userSessionsMax: number;
	/** Soft cap on concurrent sessions before LRU eviction. Default: 10. */
	userSessionsDefault: number;
	/** Maximum array size for request params (roles, labels, etc.). Default: 100. */
	arrayParamsSize: number;
}

export interface ProjectSettings {
	auths: ProjectAuthSettings;
	limits: ProjectLimitSettings;
}

export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends (infer U)[]
		? U[]
		: T[P] extends object
			? DeepPartial<T[P]>
			: T[P];
};
