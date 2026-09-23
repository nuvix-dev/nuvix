import { describe, expect, test } from "bun:test";
import { defaultProjectSettings } from "./defaults";
import { resolveSettings } from "./resolve";

describe("resolveSettings", () => {
	test("returns clone of defaults when no overrides provided", () => {
		const settings = resolveSettings();
		expect(settings).toEqual(defaultProjectSettings);
		// Mutation test — ensure it is a copy
		settings.auths.emailPassword = false;
		expect(defaultProjectSettings.auths.emailPassword).toBe(true);
	});

	test("overrides specific auth boolean flags", () => {
		const settings = resolveSettings({
			auths: {
				emailPassword: false,
				phone: true,
			},
		});
		expect(settings.auths.emailPassword).toBe(false);
		expect(settings.auths.phone).toBe(true);
		expect(settings.auths.anonymous).toBe(true); // preserved
		expect(settings.limits.userSessionsMax).toBe(100); // preserved
	});

	test("overrides specific limits", () => {
		const settings = resolveSettings({
			limits: {
				userSessionsMax: 50,
			},
		});
		expect(settings.limits.userSessionsMax).toBe(50);
		expect(settings.limits.userSessionsDefault).toBe(10);
	});

	test("overrides mockNumbers array cleanly", () => {
		const settings = resolveSettings({
			auths: {
				mockNumbers: ["+15550009999"],
			},
		});
		expect(settings.auths.mockNumbers).toEqual(["+15550009999"]);
		expect(defaultProjectSettings.auths.mockNumbers).toEqual([]);
	});
});
