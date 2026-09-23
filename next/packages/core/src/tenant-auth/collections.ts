import {
	AttributeType,
	type Collection,
	Database,
	ID,
	IndexType,
} from "@nuvix/db";

/**
 * Core-provided auth collections — the fixed schema every project gets for
 * end-user accounts/teams, regardless of whatever custom document schemas
 * the project's own developers create later (`docs/api/database.md`, still
 * unimplemented). Lives in a dedicated `auth` Postgres schema inside each
 * tenant database (see `./schema.ts`) so it can never collide with a
 * user-created schema name.
 *
 * Ported from legacy `libs/utils/src/collections/common.ts`
 * (`authCollections`) per `docs/api/account.md` / `docs/api/teams.md` /
 * `docs/api/users.md`. Virtual `subQuery*` fields (legacy's ad-hoc
 * "embed related rows" filters) are dropped — `@nuvix/db` has no equivalent
 * mechanism and none is needed: the one relation actually exposed in a
 * response (`targets` on the user object) is assembled by the service layer
 * with a plain query, not a schema-level trick.
 */

const users: Collection = {
	$collection: Database.METADATA,
	$id: ID.custom("users"),
	name: "Users",
	documentSecurity: true,
	enabled: true,
	attributes: [
		{
			$id: ID.custom("name"),
			key: "name",
			type: AttributeType.String,
			size: 256,
		},
		{
			$id: ID.custom("email"),
			key: "email",
			type: AttributeType.String,
			size: 320,
		},
		{
			$id: ID.custom("phone"),
			key: "phone",
			type: AttributeType.String,
			size: 16,
		},
		{
			$id: ID.custom("status"),
			key: "status",
			type: AttributeType.Boolean,
			required: true,
			default: true,
		},
		{
			$id: ID.custom("labels"),
			key: "labels",
			type: AttributeType.String,
			size: 128,
			array: true,
		},
		{
			$id: ID.custom("passwordHistory"),
			key: "passwordHistory",
			type: AttributeType.String,
			size: 16384,
			array: true,
		},
		{
			$id: ID.custom("password"),
			key: "password",
			type: AttributeType.String,
			size: 16384,
			filters: ["accountEncrypt"],
		},
		{
			$id: ID.custom("hash"),
			key: "hash",
			type: AttributeType.String,
			size: 256,
			default: "argon2id",
		},
		{
			$id: ID.custom("hashOptions"),
			key: "hashOptions",
			type: AttributeType.Json,
		},
		{
			$id: ID.custom("passwordUpdate"),
			key: "passwordUpdate",
			type: AttributeType.Timestamptz,
		},
		{
			$id: ID.custom("prefs"),
			key: "prefs",
			type: AttributeType.Json,
			default: {},
		},
		{
			$id: ID.custom("registration"),
			key: "registration",
			type: AttributeType.Timestamptz,
		},
		{
			$id: ID.custom("emailVerification"),
			key: "emailVerification",
			type: AttributeType.Boolean,
			required: true,
			default: false,
		},
		{
			$id: ID.custom("phoneVerification"),
			key: "phoneVerification",
			type: AttributeType.Boolean,
			required: true,
			default: false,
		},
		{
			$id: ID.custom("mfa"),
			key: "mfa",
			type: AttributeType.Boolean,
			required: true,
			default: false,
		},
		{
			$id: ID.custom("mfaRecoveryCodes"),
			key: "mfaRecoveryCodes",
			type: AttributeType.String,
			size: 256,
			array: true,
			filters: ["accountEncrypt"],
		},
		{
			$id: ID.custom("search"),
			key: "search",
			type: AttributeType.String,
			size: 16384,
		},
		{
			$id: ID.custom("accessedAt"),
			key: "accessedAt",
			type: AttributeType.Timestamptz,
		},
	],
	indexes: [
		{
			$id: ID.custom("idx_name"),
			key: "idx_name",
			type: IndexType.Key,
			attributes: ["name"],
		},
		{
			$id: ID.custom("idx_email"),
			key: "idx_email",
			type: IndexType.Unique,
			attributes: ["email"],
		},
		{
			$id: ID.custom("idx_phone"),
			key: "idx_phone",
			type: IndexType.Unique,
			attributes: ["phone"],
		},
		{
			$id: ID.custom("idx_status"),
			key: "idx_status",
			type: IndexType.Key,
			attributes: ["status"],
		},
		{
			$id: ID.custom("idx_password_update"),
			key: "idx_password_update",
			type: IndexType.Key,
			attributes: ["passwordUpdate"],
		},
		{
			$id: ID.custom("idx_registration"),
			key: "idx_registration",
			type: IndexType.Key,
			attributes: ["registration"],
		},
		{
			$id: ID.custom("idx_email_verification"),
			key: "idx_email_verification",
			type: IndexType.Key,
			attributes: ["emailVerification"],
		},
		{
			$id: ID.custom("idx_phone_verification"),
			key: "idx_phone_verification",
			type: IndexType.Key,
			attributes: ["phoneVerification"],
		},
		{
			$id: ID.custom("idx_search"),
			key: "idx_search",
			type: IndexType.FullText,
			attributes: ["search"],
		},
		{
			$id: ID.custom("idx_accessed_at"),
			key: "idx_accessed_at",
			type: IndexType.Key,
			attributes: ["accessedAt"],
		},
	],
};

const sessions: Collection = {
	$collection: Database.METADATA,
	$id: ID.custom("sessions"),
	name: "Sessions",
	documentSecurity: true,
	enabled: true,
	attributes: [
		{
			$id: ID.custom("userId"),
			key: "userId",
			type: AttributeType.String,
			size: Database.LENGTH_KEY,
			required: true,
		},
		{
			$id: ID.custom("provider"),
			key: "provider",
			type: AttributeType.String,
			size: 128,
		},
		{
			$id: ID.custom("providerUid"),
			key: "providerUid",
			type: AttributeType.String,
			size: 2048,
		},
		{
			$id: ID.custom("providerAccessToken"),
			key: "providerAccessToken",
			type: AttributeType.String,
			size: 16384,
			filters: ["accountEncrypt"],
		},
		{
			$id: ID.custom("providerAccessTokenExpiry"),
			key: "providerAccessTokenExpiry",
			type: AttributeType.Timestamptz,
		},
		{
			$id: ID.custom("providerRefreshToken"),
			key: "providerRefreshToken",
			type: AttributeType.String,
			size: 16384,
			filters: ["accountEncrypt"],
		},
		{
			$id: ID.custom("secretHash"),
			key: "secretHash",
			type: AttributeType.String,
			size: 128,
			required: true,
		},
		{
			$id: ID.custom("userAgent"),
			key: "userAgent",
			type: AttributeType.String,
			size: 16384,
		},
		{ $id: ID.custom("ip"), key: "ip", type: AttributeType.String, size: 45 },
		{
			$id: ID.custom("countryCode"),
			key: "countryCode",
			type: AttributeType.String,
			size: 2,
		},
		{
			$id: ID.custom("osCode"),
			key: "osCode",
			type: AttributeType.String,
			size: 256,
		},
		{
			$id: ID.custom("osName"),
			key: "osName",
			type: AttributeType.String,
			size: 256,
		},
		{
			$id: ID.custom("osVersion"),
			key: "osVersion",
			type: AttributeType.String,
			size: 256,
		},
		{
			$id: ID.custom("clientType"),
			key: "clientType",
			type: AttributeType.String,
			size: 256,
		},
		{
			$id: ID.custom("clientCode"),
			key: "clientCode",
			type: AttributeType.String,
			size: 256,
		},
		{
			$id: ID.custom("clientName"),
			key: "clientName",
			type: AttributeType.String,
			size: 256,
		},
		{
			$id: ID.custom("clientVersion"),
			key: "clientVersion",
			type: AttributeType.String,
			size: 256,
		},
		{
			$id: ID.custom("clientEngine"),
			key: "clientEngine",
			type: AttributeType.String,
			size: 256,
		},
		{
			$id: ID.custom("clientEngineVersion"),
			key: "clientEngineVersion",
			type: AttributeType.String,
			size: 256,
		},
		{
			$id: ID.custom("deviceName"),
			key: "deviceName",
			type: AttributeType.String,
			size: 256,
		},
		{
			$id: ID.custom("deviceBrand"),
			key: "deviceBrand",
			type: AttributeType.String,
			size: 256,
		},
		{
			$id: ID.custom("deviceModel"),
			key: "deviceModel",
			type: AttributeType.String,
			size: 256,
		},
		{
			$id: ID.custom("factors"),
			key: "factors",
			type: AttributeType.String,
			size: 256,
			array: true,
		},
		{
			$id: ID.custom("expire"),
			key: "expire",
			type: AttributeType.Timestamptz,
			required: true,
		},
		{
			$id: ID.custom("mfaUpdatedAt"),
			key: "mfaUpdatedAt",
			type: AttributeType.Timestamptz,
		},
	],
	indexes: [
		{
			$id: ID.custom("idx_user"),
			key: "idx_user",
			type: IndexType.Key,
			attributes: ["userId"],
		},
		{
			$id: ID.custom("idx_provider"),
			key: "idx_provider",
			type: IndexType.Key,
			attributes: ["provider", "providerUid"],
		},
		{
			$id: ID.custom("idx_secret_hash"),
			key: "idx_secret_hash",
			type: IndexType.Unique,
			attributes: ["secretHash"],
		},
	],
};

const tokens: Collection = {
	$collection: Database.METADATA,
	$id: ID.custom("tokens"),
	name: "Tokens",
	documentSecurity: true,
	enabled: true,
	attributes: [
		{
			$id: ID.custom("userId"),
			key: "userId",
			type: AttributeType.String,
			size: Database.LENGTH_KEY,
			required: true,
		},
		{
			$id: ID.custom("type"),
			key: "type",
			type: AttributeType.Integer,
			required: true,
		},
		{
			$id: ID.custom("secretHash"),
			key: "secretHash",
			type: AttributeType.String,
			size: 128,
			required: true,
		},
		{
			$id: ID.custom("expire"),
			key: "expire",
			type: AttributeType.Timestamptz,
		},
		{
			$id: ID.custom("userAgent"),
			key: "userAgent",
			type: AttributeType.String,
			size: 16384,
		},
		{ $id: ID.custom("ip"), key: "ip", type: AttributeType.String, size: 45 },
	],
	indexes: [
		{
			$id: ID.custom("idx_user"),
			key: "idx_user",
			type: IndexType.Key,
			attributes: ["userId"],
		},
		{
			$id: ID.custom("idx_secret_hash"),
			key: "idx_secret_hash",
			type: IndexType.Unique,
			attributes: ["secretHash"],
		},
	],
};

const authenticators: Collection = {
	$collection: Database.METADATA,
	$id: ID.custom("authenticators"),
	name: "Authenticators",
	documentSecurity: true,
	enabled: true,
	attributes: [
		{
			$id: ID.custom("userId"),
			key: "userId",
			type: AttributeType.String,
			size: Database.LENGTH_KEY,
			required: true,
		},
		{
			$id: ID.custom("type"),
			key: "type",
			type: AttributeType.String,
			size: Database.LENGTH_KEY,
			required: true,
		},
		{
			$id: ID.custom("verified"),
			key: "verified",
			type: AttributeType.Boolean,
			required: true,
			default: false,
		},
		{
			$id: ID.custom("data"),
			key: "data",
			type: AttributeType.String,
			size: 65535,
			filters: ["json", "accountEncrypt"],
		},
	],
	indexes: [
		{
			$id: ID.custom("idx_user"),
			key: "idx_user",
			type: IndexType.Key,
			attributes: ["userId"],
		},
		{
			$id: ID.custom("idx_user_type"),
			key: "idx_user_type",
			type: IndexType.Unique,
			attributes: ["userId", "type"],
		},
	],
};

const challenges: Collection = {
	$collection: Database.METADATA,
	$id: ID.custom("challenges"),
	name: "Challenges",
	documentSecurity: true,
	enabled: true,
	attributes: [
		{
			$id: ID.custom("userId"),
			key: "userId",
			type: AttributeType.String,
			size: Database.LENGTH_KEY,
			required: true,
		},
		{
			$id: ID.custom("type"),
			key: "type",
			type: AttributeType.String,
			size: Database.LENGTH_KEY,
			required: true,
		},
		{
			$id: ID.custom("token"),
			key: "token",
			type: AttributeType.String,
			size: 512,
			filters: ["accountEncrypt"],
		},
		{
			$id: ID.custom("code"),
			key: "code",
			type: AttributeType.String,
			size: 512,
			filters: ["accountEncrypt"],
		},
		{
			$id: ID.custom("expire"),
			key: "expire",
			type: AttributeType.Timestamptz,
			required: true,
		},
	],
	indexes: [
		{
			$id: ID.custom("idx_user"),
			key: "idx_user",
			type: IndexType.Key,
			attributes: ["userId"],
		},
	],
};

const identities: Collection = {
	$collection: Database.METADATA,
	$id: ID.custom("identities"),
	name: "Identities",
	documentSecurity: true,
	enabled: true,
	attributes: [
		{
			$id: ID.custom("userId"),
			key: "userId",
			type: AttributeType.String,
			size: Database.LENGTH_KEY,
			required: true,
		},
		{
			$id: ID.custom("provider"),
			key: "provider",
			type: AttributeType.String,
			size: 128,
			required: true,
		},
		{
			$id: ID.custom("providerUid"),
			key: "providerUid",
			type: AttributeType.String,
			size: 2048,
			required: true,
		},
		{
			$id: ID.custom("providerEmail"),
			key: "providerEmail",
			type: AttributeType.String,
			size: 320,
		},
		{
			$id: ID.custom("providerAccessToken"),
			key: "providerAccessToken",
			type: AttributeType.String,
			size: 16384,
			filters: ["accountEncrypt"],
		},
		{
			$id: ID.custom("providerAccessTokenExpiry"),
			key: "providerAccessTokenExpiry",
			type: AttributeType.Timestamptz,
		},
		{
			$id: ID.custom("providerRefreshToken"),
			key: "providerRefreshToken",
			type: AttributeType.String,
			size: 16384,
			filters: ["accountEncrypt"],
		},
	],
	indexes: [
		{
			$id: ID.custom("idx_provider_uid"),
			key: "idx_provider_uid",
			type: IndexType.Unique,
			attributes: ["provider", "providerUid"],
		},
		{
			$id: ID.custom("idx_user"),
			key: "idx_user",
			type: IndexType.Key,
			attributes: ["userId"],
		},
		{
			$id: ID.custom("idx_provider"),
			key: "idx_provider",
			type: IndexType.Key,
			attributes: ["provider"],
		},
		{
			$id: ID.custom("idx_provider_email"),
			key: "idx_provider_email",
			type: IndexType.Key,
			attributes: ["providerEmail"],
		},
	],
};

const targets: Collection = {
	$collection: Database.METADATA,
	$id: ID.custom("targets"),
	name: "Targets",
	documentSecurity: true,
	enabled: true,
	attributes: [
		{
			$id: ID.custom("userId"),
			key: "userId",
			type: AttributeType.String,
			size: Database.LENGTH_KEY,
			required: true,
		},
		{
			$id: ID.custom("providerType"),
			key: "providerType",
			type: AttributeType.String,
			size: Database.LENGTH_KEY,
			required: true,
		},
		{
			$id: ID.custom("providerId"),
			key: "providerId",
			type: AttributeType.String,
			size: Database.LENGTH_KEY,
		},
		{
			$id: ID.custom("identifier"),
			key: "identifier",
			type: AttributeType.String,
			size: Database.LENGTH_KEY,
			required: true,
		},
		{
			$id: ID.custom("name"),
			key: "name",
			type: AttributeType.String,
			size: 128,
		},
		{
			$id: ID.custom("expired"),
			key: "expired",
			type: AttributeType.Boolean,
			required: true,
			default: false,
		},
	],
	indexes: [
		{
			$id: ID.custom("idx_user"),
			key: "idx_user",
			type: IndexType.Key,
			attributes: ["userId"],
		},
		{
			$id: ID.custom("idx_provider"),
			key: "idx_provider",
			type: IndexType.Key,
			attributes: ["providerId"],
		},
		{
			$id: ID.custom("idx_identifier"),
			key: "idx_identifier",
			type: IndexType.Unique,
			attributes: ["identifier"],
		},
	],
};

const teams: Collection = {
	$collection: Database.METADATA,
	$id: ID.custom("teams"),
	name: "Teams",
	documentSecurity: true,
	enabled: true,
	attributes: [
		{
			$id: ID.custom("name"),
			key: "name",
			type: AttributeType.String,
			size: 128,
			required: true,
		},
		{
			$id: ID.custom("total"),
			key: "total",
			type: AttributeType.Integer,
			required: true,
			default: 0,
		},
		{
			$id: ID.custom("search"),
			key: "search",
			type: AttributeType.String,
			size: 16384,
		},
		{
			$id: ID.custom("prefs"),
			key: "prefs",
			type: AttributeType.Json,
			default: {},
		},
	],
	indexes: [
		{
			$id: ID.custom("idx_name"),
			key: "idx_name",
			type: IndexType.Key,
			attributes: ["name"],
		},
		{
			$id: ID.custom("idx_total"),
			key: "idx_total",
			type: IndexType.Key,
			attributes: ["total"],
		},
		{
			$id: ID.custom("idx_search"),
			key: "idx_search",
			type: IndexType.FullText,
			attributes: ["search"],
		},
	],
};

const memberships: Collection = {
	$collection: Database.METADATA,
	$id: ID.custom("memberships"),
	name: "Memberships",
	documentSecurity: true,
	enabled: true,
	attributes: [
		{
			$id: ID.custom("userId"),
			key: "userId",
			type: AttributeType.String,
			size: Database.LENGTH_KEY,
			required: true,
		},
		{
			$id: ID.custom("teamId"),
			key: "teamId",
			type: AttributeType.String,
			size: Database.LENGTH_KEY,
			required: true,
		},
		{
			$id: ID.custom("roles"),
			key: "roles",
			type: AttributeType.String,
			size: 128,
			array: true,
		},
		{
			$id: ID.custom("invited"),
			key: "invited",
			type: AttributeType.Timestamptz,
		},
		{
			$id: ID.custom("joined"),
			key: "joined",
			type: AttributeType.Timestamptz,
		},
		{
			$id: ID.custom("confirm"),
			key: "confirm",
			type: AttributeType.Boolean,
			required: true,
			default: false,
		},
		{
			$id: ID.custom("secretHash"),
			key: "secretHash",
			type: AttributeType.String,
			size: 128,
		},
		{
			$id: ID.custom("search"),
			key: "search",
			type: AttributeType.String,
			size: 16384,
		},
	],
	indexes: [
		{
			$id: ID.custom("idx_unique"),
			key: "idx_unique",
			type: IndexType.Unique,
			attributes: ["teamId", "userId"],
		},
		{
			$id: ID.custom("idx_user"),
			key: "idx_user",
			type: IndexType.Key,
			attributes: ["userId"],
		},
		{
			$id: ID.custom("idx_team"),
			key: "idx_team",
			type: IndexType.Key,
			attributes: ["teamId"],
		},
		{
			$id: ID.custom("idx_search"),
			key: "idx_search",
			type: IndexType.FullText,
			attributes: ["search"],
		},
		{
			$id: ID.custom("idx_invited"),
			key: "idx_invited",
			type: IndexType.Key,
			attributes: ["invited"],
		},
		{
			$id: ID.custom("idx_joined"),
			key: "idx_joined",
			type: IndexType.Key,
			attributes: ["joined"],
		},
		{
			$id: ID.custom("idx_confirm"),
			key: "idx_confirm",
			type: IndexType.Key,
			attributes: ["confirm"],
		},
	],
};

/**
 * All core auth collections, bootstrapped together by `ensureAuthSchema`.
 * Order matters only for readability — `@nuvix/db` collections here have no
 * foreign-key/relationship attributes between them (deliberately: see the
 * module doc comment), so creation order is not a dependency ordering.
 */
export const authCollections: Collection[] = [
	users,
	sessions,
	tokens,
	authenticators,
	challenges,
	identities,
	targets,
	teams,
	memberships,
];
