import { waitUntilPostgresReady } from "./readiness";
import type {
	DeprovisionOptions,
	ProvisionRequest,
	ProvisionResult,
	TenantHandle,
	TenantProvisioner,
	TenantTarget,
	WaitUntilReadyOptions,
} from "./types";

/**
 * Provisions one dedicated `nuvix/postgres:18.1` container per project on a
 * single Docker host (D20, D37). Talks to the Docker CLI via `Bun.spawn`
 * rather than the HTTP/socket API — dependency-free, matches AGENTS.md's
 * Bun-native-first rule.
 *
 * Networking: host-mapped random port (`-p 0:5432`) — works identically for
 * local `bun run dev` and a single self-hosted box; an internal-network-only
 * mode is a later hardening pass, not this slice.
 *
 * Volumes: named per project, so `docker rm -f` (no `-v`) never touches tenant
 * data — that's what makes "keep the volume by default" fall out for free.
 * A `purge` deprovision additionally removes the volume.
 */
export interface DockerTenantProvisionerOptions {
	/** Exact tenant image — AGENTS.md/D24 pin this to `nuvix/postgres:18.1`. */
	image?: string;
	/** Prefix for container/volume names, so multiple environments can share a host. */
	namePrefix?: string;
	/** Postgres superuser role baked into the image. */
	adminUser?: string;
	/** Database created by the image's own first-boot init. */
	adminDatabase?: string;
}

const DEFAULT_IMAGE = "nuvix/postgres:18.1";
const DEFAULT_NAME_PREFIX = "nuvix-tenant";
const DEFAULT_ADMIN_USER = "nuvix_admin";
const DEFAULT_ADMIN_DATABASE = "postgres";

async function runDocker(args: string[]): Promise<string> {
	const proc = Bun.spawn(["docker", ...args], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		proc.stdout.text(),
		proc.stderr.text(),
		proc.exited,
	]);
	if (exitCode !== 0) {
		throw new Error(
			`docker ${args.join(" ")} failed (exit ${exitCode}): ${stderr.trim()}`,
		);
	}
	return stdout.trim();
}

/** Generates a Postgres-safe random password (no shell-hostile characters). */
function generatePassword(): string {
	return Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString(
		"base64url",
	);
}

export class DockerTenantProvisioner implements TenantProvisioner {
	private readonly image: string;
	private readonly namePrefix: string;
	private readonly adminUser: string;
	private readonly adminDatabase: string;

	constructor(options: DockerTenantProvisionerOptions = {}) {
		this.image = options.image ?? DEFAULT_IMAGE;
		this.namePrefix = options.namePrefix ?? DEFAULT_NAME_PREFIX;
		this.adminUser = options.adminUser ?? DEFAULT_ADMIN_USER;
		this.adminDatabase = options.adminDatabase ?? DEFAULT_ADMIN_DATABASE;
	}

	private containerName(projectId: string): string {
		return `${this.namePrefix}-${projectId}`;
	}

	private volumeName(projectId: string): string {
		return `${this.namePrefix}-${projectId}-data`;
	}

	async provision({ projectId }: ProvisionRequest): Promise<ProvisionResult> {
		const containerName = this.containerName(projectId);
		const volumeName = this.volumeName(projectId);
		const password = generatePassword();

		await runDocker(["volume", "create", volumeName]);

		await runDocker([
			"run",
			"-d",
			"--name",
			containerName,
			"--label",
			"nuvix.tenant=true",
			"--label",
			`nuvix.project-id=${projectId}`,
			"-e",
			`POSTGRES_PASSWORD=${password}`,
			"-v",
			`${volumeName}:/var/lib/postgresql/data`,
			"-p",
			"0:5432",
			this.image,
		]);

		const port = await this.resolveHostPort(containerName);

		const handle: TenantHandle = { projectId, containerName, volumeName };
		const target: TenantTarget = {
			host: "127.0.0.1",
			port,
			database: this.adminDatabase,
			user: this.adminUser,
			password,
		};
		return { handle, target };
	}

	private async resolveHostPort(containerName: string): Promise<number> {
		// `docker port <name> 5432/tcp` prints one "host:port" line per bound
		// address family (e.g. 0.0.0.0:32768 and [::]:32768) — take the first.
		const output = await runDocker(["port", containerName, "5432/tcp"]);
		const firstLine = output.split("\n")[0]?.trim();
		const port = Number(firstLine?.split(":").pop());
		if (!Number.isInteger(port) || port <= 0) {
			throw new Error(
				`Could not resolve host port for container ${containerName}: ${output}`,
			);
		}
		return port;
	}

	async waitUntilReady(
		target: TenantTarget,
		options?: WaitUntilReadyOptions,
	): Promise<void> {
		return waitUntilPostgresReady(target, options);
	}

	async deprovision(
		handle: TenantHandle,
		options: DeprovisionOptions = {},
	): Promise<void> {
		await runDocker(["rm", "-f", handle.containerName]).catch((error) => {
			// Already gone is fine; anything else surfaces.
			if (!String(error).includes("No such container")) throw error;
		});
		if (options.purge) {
			await runDocker(["volume", "rm", handle.volumeName]).catch((error) => {
				if (!String(error).includes("No such volume")) throw error;
			});
		}
	}
}
