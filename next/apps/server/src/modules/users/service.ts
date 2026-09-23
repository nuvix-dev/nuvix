import { hashPassword } from "@nuvix/core/auth";
import { Doc, ID, Query, type Session } from "@nuvix/db";
import { ConflictError, NotFoundError } from "../../shared/errors";
import type { Targets, TargetsDoc, Users } from "../../types/generated";
import { formatUser, type UserView } from "./formatter";

export class UserService {
	constructor(private readonly session: Session) {}

	async create(input: {
		userId?: string;
		email?: string;
		phone?: string;
		password?: string;
		name?: string;
	}): Promise<UserView> {
		const userId =
			input.userId && input.userId !== "unique()"
				? input.userId
				: ID.custom(ID.unique());

		if (input.email) {
			const existingEmail = await this.session.findOne("users", [
				Query.equal("email", [input.email]),
			]);
			if (!existingEmail.empty()) {
				throw new ConflictError("User with this email already exists", {
					code: "user_email_already_exists",
				});
			}
		}

		if (input.phone) {
			const existingPhone = await this.session.findOne("users", [
				Query.equal("phone", [input.phone]),
			]);
			if (!existingPhone.empty()) {
				throw new ConflictError("User with this phone already exists", {
					code: "user_phone_already_exists",
				});
			}
		}

		let hash = "";
		let hashOptions: Record<string, unknown> | undefined;
		let passwordUpdate: string | undefined;
		if (input.password) {
			hash = await hashPassword(input.password, { algorithm: "argon2id" });
			passwordUpdate = new Date().toISOString();
		}

		const now = new Date().toISOString();

		const userDoc = await this.session.createDocument(
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
				password: hash,
				hash: input.password ? "argon2id" : "argon2id",
				hashOptions: hashOptions ?? {},
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
			const emailTarget = await this.session.createDocument(
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
			const phoneTarget = await this.session.createDocument(
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

		return formatUser(userDoc, targets);
	}

	async get(userId: string): Promise<UserView> {
		const userDoc = await this.session.getDocument("users", userId);
		if (userDoc.empty()) {
			throw new NotFoundError("User not found", { code: "user_not_found" });
		}
		const targets = await this.session.find("targets", [
			Query.equal("userId", [userId]),
		]);
		return formatUser(userDoc, targets);
	}
}
