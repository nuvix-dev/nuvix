import { defaultProjectSettings } from "./defaults";
import type { DeepPartial, ProjectSettings } from "./types";

/**
 * Resolve effective project settings by merging project-specific overrides
 * on top of the standard defaults.
 */
export function resolveSettings(
	overrides?: DeepPartial<ProjectSettings>,
): ProjectSettings {
	if (!overrides) {
		return {
			auths: { ...defaultProjectSettings.auths },
			limits: { ...defaultProjectSettings.limits },
		};
	}

	return {
		auths: {
			...defaultProjectSettings.auths,
			...(overrides.auths ?? {}),
			mockNumbers: overrides.auths?.mockNumbers
				? [...overrides.auths.mockNumbers]
				: [...defaultProjectSettings.auths.mockNumbers],
		},
		limits: {
			...defaultProjectSettings.limits,
			...(overrides.limits ?? {}),
		},
	};
}
