import type { ProjectSettings } from "./types";

/**
 * Standard defaults for project-scoped auth gates and limits.
 * Carried forward from legacy configuration, formalizing D42.
 */
export const defaultProjectSettings: ProjectSettings = {
	auths: {
		emailPassword: true,
		anonymous: true,
		magicUrl: true,
		emailOtp: true,
		phone: false,
		invites: true,
		duration: 31536000, // 1 year
		limit: 0, // unlimited
		passwordHistory: 0, // disabled
		personalDataCheck: false,
		sessionAlerts: false,
		mockNumbers: [],
	},
	limits: {
		userSessionsMax: 100,
		userSessionsDefault: 10,
		arrayParamsSize: 100,
	},
};
