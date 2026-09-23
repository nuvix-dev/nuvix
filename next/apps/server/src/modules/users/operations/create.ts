import { hashPassword } from "@nuvix/core/auth";
import { Doc, ID, Query, type Session } from "@nuvix/db";
import { BadRequestError, ConflictError } from "../../../shared/errors";
import type {
	Targets,
	TargetsDoc,
	Users,
	UsersDoc,
} from "../../../types/generated";

export interface CreateUserInput {
	userId?: string;
	email?: string;
	phone?: string;
	password?: string;
	name?: string;
}

export interface CreateHashedUserInput {
	userId?: string;
	email?: string;
	phone?: string;
	password: string;
	hashOptions?: Record<string, unknown>;
	name?: string;
}

export async function createUser(
	session: Session,
	input: CreateUserInput,
): Promise<{ user: UsersDoc; targets: TargetsDoc[] }> {
	if (!input.email && !input.phone) {
		throw new BadRequestError("At least one of email or phone is required", {
			code: "user_identifier_missing",
		});
	}

	const userId =
		input.userId && input.userId !== "unique()"
			? input.userId
			: ID.custom(ID.unique());

	if (input.email) {
		const existingEmail = await session.findOne("users", [
			Query.equal("email", [input.email]),
		]);
		if (!existingEmail.empty()) {
			throw new ConflictError("User with this email already exists", {
				code: "user_email_already_exists",
			});
		}
	}

	if (input.phone) {
		const existingPhone = await session.findOne("users", [
			Query.equal("phone", [input.phone]),
		]);
		if (!existingPhone.empty()) {
			throw new ConflictError("User with this phone already exists", {
				code: "user_phone_already_exists",
			});
		}
	}

	const hash = "argon2id";
	let passwordHash = "";
	let passwordUpdate: string | undefined;

	if (input.password) {
		passwordHash = await hashPassword(input.password, {
			algorithm: "argon2id",
		});
		passwordUpdate = new Date().toISOString();
	}

	const now = new Date().toISOString();

	const userDoc = await session.createDocument(
		"users",
		new Doc<Users>({
			$id: userId,
			name: input.name ?? "",
			email: input.email ?? "",
			phone: input.phone ?? "",
			status: true,
			emailVerification: false,
			phoneVerification: false,
			mfa: false,
			labels: [],
			passwordHistory: [],
			password: passwordHash,
			hash,
			hashOptions: {},
			passwordUpdate,
			registration: now,
			accessedAt: now,
			prefs: {},
			search: [userId, input.email ?? "", input.phone ?? "", input.name ?? ""]
				.filter(Boolean)
				.join(" "),
		}),
	);

	const targets: TargetsDoc[] = [];

	if (input.email) {
		const emailTarget = await session.createDocument(
			"targets",
			new Doc<Targets>({
				$id: ID.unique(),
				userId,
				providerType: "email",
				identifier: input.email,
				name: input.name ?? "",
				expired: false,
			}),
		);
		targets.push(emailTarget);
	}

	if (input.phone) {
		const phoneTarget = await session.createDocument(
			"targets",
			new Doc<Targets>({
				$id: ID.unique(),
				userId,
				providerType: "sms",
				identifier: input.phone,
				name: input.name ?? "",
				expired: false,
			}),
		);
		targets.push(phoneTarget);
	}

	return { user: userDoc, targets };
}

export async function createPreHashedUser(
	session: Session,
	algorithm: "argon2id" | "bcrypt",
	input: CreateHashedUserInput,
): Promise<{ user: UsersDoc; targets: TargetsDoc[] }> {
	if (!input.email && !input.phone) {
		throw new BadRequestError("At least one of email or phone is required", {
			code: "user_identifier_missing",
		});
	}

	const userId =
		input.userId && input.userId !== "unique()"
			? input.userId
			: ID.custom(ID.unique());

	if (input.email) {
		const existingEmail = await session.findOne("users", [
			Query.equal("email", [input.email]),
		]);
		if (!existingEmail.empty()) {
			throw new ConflictError("User with this email already exists", {
				code: "user_email_already_exists",
			});
		}
	}

	if (input.phone) {
		const existingPhone = await session.findOne("users", [
			Query.equal("phone", [input.phone]),
		]);
		if (!existingPhone.empty()) {
			throw new ConflictError("User with this phone already exists", {
				code: "user_phone_already_exists",
			});
		}
	}

	const now = new Date().toISOString();

	const userDoc = await session.createDocument(
		"users",
		new Doc<Users>({
			$id: userId,
			name: input.name ?? "",
			email: input.email ?? "",
			phone: input.phone ?? "",
			status: true,
			emailVerification: false,
			phoneVerification: false,
			mfa: false,
			labels: [],
			passwordHistory: [],
			password: input.password,
			hash: algorithm,
			hashOptions: input.hashOptions ?? {},
			passwordUpdate: now,
			registration: now,
			accessedAt: now,
			prefs: {},
			search: [userId, input.email ?? "", input.phone ?? "", input.name ?? ""]
				.filter(Boolean)
				.join(" "),
		}),
	);

	const targets: TargetsDoc[] = [];

	if (input.email) {
		const emailTarget = await session.createDocument(
			"targets",
			new Doc<Targets>({
				$id: ID.unique(),
				userId,
				providerType: "email",
				identifier: input.email,
				name: input.name ?? "",
				expired: false,
			}),
		);
		targets.push(emailTarget);
	}

	if (input.phone) {
		const phoneTarget = await session.createDocument(
			"targets",
			new Doc<Targets>({
				$id: ID.unique(),
				userId,
				providerType: "sms",
				identifier: input.phone,
				name: input.name ?? "",
				expired: false,
			}),
		);
		targets.push(phoneTarget);
	}

	return { user: userDoc, targets };
}
