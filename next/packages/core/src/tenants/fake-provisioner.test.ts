import { describe, expect, test } from "bun:test";
import { FakeTenantProvisioner } from "./fake-provisioner";

describe("FakeTenantProvisioner", () => {
	test("provision returns a distinct target per project", async () => {
		const provisioner = new FakeTenantProvisioner();
		const a = await provisioner.provision({ projectId: "proj-a" });
		const b = await provisioner.provision({ projectId: "proj-b" });

		expect(a.target.port).not.toBe(b.target.port);
		expect(a.handle.containerName).toContain("proj-a");
		expect(provisioner.provisioned.size).toBe(2);
	});

	test("waitUntilReady resolves without a real connection", async () => {
		const provisioner = new FakeTenantProvisioner();
		const { target } = await provisioner.provision({ projectId: "proj-c" });
		await expect(provisioner.waitUntilReady(target)).resolves.toBeUndefined();
	});

	test("deprovision removes the tracked handle", async () => {
		const provisioner = new FakeTenantProvisioner();
		const { handle } = await provisioner.provision({ projectId: "proj-d" });
		await provisioner.deprovision(handle);
		expect(provisioner.provisioned.has("proj-d")).toBe(false);
	});
});
