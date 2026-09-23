import { Query, type Session } from "@nuvix/db";
import { formatUser, type UserView } from "./formatter";
import {
	type CreateHashedUserInput,
	type CreateUserInput,
	createPreHashedUser,
	createUser,
} from "./operations/create";
import { deleteUser } from "./operations/delete";
import {
	getUserOrThrow,
	updateUserEmail,
	updateUserLabels,
	updateUserName,
	updateUserPassword,
	updateUserPhone,
	updateUserPhoneVerification,
	updateUserPrefs,
	updateUserStatus,
	updateUserVerification,
} from "./operations/update";

export interface ListUsersOptions {
	queries?: Query[];
	search?: string;
	limit?: number;
	offset?: number;
}

export class UserService {
	constructor(private readonly session: Session) {}

	async create(input: CreateUserInput): Promise<UserView> {
		const { user, targets } = await createUser(this.session, input);
		return formatUser(user, targets, { includePasswordHash: true });
	}

	async createArgon2(input: CreateHashedUserInput): Promise<UserView> {
		const { user, targets } = await createPreHashedUser(
			this.session,
			"argon2id",
			input,
		);
		return formatUser(user, targets, { includePasswordHash: true });
	}

	async createBcrypt(input: CreateHashedUserInput): Promise<UserView> {
		const { user, targets } = await createPreHashedUser(
			this.session,
			"bcrypt",
			input,
		);
		return formatUser(user, targets, { includePasswordHash: true });
	}

	async get(userId: string): Promise<UserView> {
		const user = await getUserOrThrow(this.session, userId);
		const targets = await this.session.find("targets", [
			Query.equal("userId", [userId]),
		]);
		return formatUser(user, targets, { includePasswordHash: true });
	}

	async list(
		options: ListUsersOptions = {},
	): Promise<{ users: UserView[]; total: number }> {
		const limit = options.limit ?? 25;
		const offset = options.offset ?? 0;
		const filterQueries = [...(options.queries ?? [])];

		if (options.search) {
			filterQueries.push(Query.search("search", options.search));
		}

		const paginatedQueries = [
			...filterQueries,
			Query.limit(limit),
			Query.offset(offset),
		];

		const [users, total] = await Promise.all([
			this.session.find("users", paginatedQueries),
			this.session.count("users", filterQueries),
		]);

		return {
			users: users.map((user) => formatUser(user, [])),
			total,
		};
	}

	async delete(userId: string): Promise<void> {
		return deleteUser(this.session, userId);
	}

	async updateName(userId: string, name: string): Promise<UserView> {
		const user = await updateUserName(this.session, userId, name);
		const targets = await this.session.find("targets", [
			Query.equal("userId", [userId]),
		]);
		return formatUser(user, targets, { includePasswordHash: true });
	}

	async updatePassword(
		userId: string,
		password: string,
		options: { maxHistory?: number; personalDataCheck?: boolean } = {},
	): Promise<UserView> {
		const user = await updateUserPassword(
			this.session,
			userId,
			password,
			options,
		);
		const targets = await this.session.find("targets", [
			Query.equal("userId", [userId]),
		]);
		return formatUser(user, targets, { includePasswordHash: true });
	}

	async updateEmail(userId: string, email: string): Promise<UserView> {
		const { user, targets } = await updateUserEmail(
			this.session,
			userId,
			email,
		);
		return formatUser(user, targets, { includePasswordHash: true });
	}

	async updatePhone(userId: string, phone: string): Promise<UserView> {
		const { user, targets } = await updateUserPhone(
			this.session,
			userId,
			phone,
		);
		return formatUser(user, targets, { includePasswordHash: true });
	}

	async updateVerification(
		userId: string,
		emailVerification: boolean,
	): Promise<UserView> {
		const user = await updateUserVerification(
			this.session,
			userId,
			emailVerification,
		);
		const targets = await this.session.find("targets", [
			Query.equal("userId", [userId]),
		]);
		return formatUser(user, targets, { includePasswordHash: true });
	}

	async updatePhoneVerification(
		userId: string,
		phoneVerification: boolean,
	): Promise<UserView> {
		const user = await updateUserPhoneVerification(
			this.session,
			userId,
			phoneVerification,
		);
		const targets = await this.session.find("targets", [
			Query.equal("userId", [userId]),
		]);
		return formatUser(user, targets, { includePasswordHash: true });
	}

	async getPrefs(userId: string): Promise<Record<string, unknown>> {
		const user = await getUserOrThrow(this.session, userId);
		return (user.get("prefs") ?? {}) as Record<string, unknown>;
	}

	async updatePrefs(
		userId: string,
		prefs: Record<string, unknown>,
	): Promise<Record<string, unknown>> {
		return updateUserPrefs(this.session, userId, prefs);
	}

	async updateLabels(userId: string, labels: string[]): Promise<UserView> {
		const user = await updateUserLabels(this.session, userId, labels);
		const targets = await this.session.find("targets", [
			Query.equal("userId", [userId]),
		]);
		return formatUser(user, targets, { includePasswordHash: true });
	}

	async updateStatus(userId: string, status: boolean): Promise<UserView> {
		const user = await updateUserStatus(this.session, userId, status);
		const targets = await this.session.find("targets", [
			Query.equal("userId", [userId]),
		]);
		return formatUser(user, targets, { includePasswordHash: true });
	}
}
