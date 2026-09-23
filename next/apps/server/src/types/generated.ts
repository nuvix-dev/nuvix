// This file is auto-generated. Do not edit manually.
// Generated on: 2026-09-22T05:17:35.438Z

import type { Doc } from "@nuvix/db";

export interface IEntity {
	$id: string;
	$createdAt: Date | string | null;
	$updatedAt: Date | string | null;
	$permissions: string[];
	$sequence: number;
	$collection: string;
	$tenant?: number | null;
	$schema?: string;
}

export interface Users extends IEntity {
	/** @optional */
	name?: string;
	/** @optional */
	email?: string;
	/** @optional */
	phone?: string;
	/**
	 * @required
	 * @default true
	 */
	status: boolean;
	/**
	 * @array
	 * @optional
	 */
	labels?: string[];
	/**
	 * @array
	 * @optional
	 */
	passwordHistory?: string[];
	/** @optional */
	password?: string;
	/**
	 * @optional
	 * @default "argon2id"
	 */
	hash?: string | "argon2id";
	/** @optional */
	hashOptions?: Record<string, any>;
	/** @optional */
	passwordUpdate?: string | Date;
	/**
	 * @optional
	 * @default {}
	 */
	prefs?: Record<string, any>;
	/** @optional */
	registration?: string | Date;
	/**
	 * @required
	 * @default false
	 */
	emailVerification: boolean;
	/**
	 * @required
	 * @default false
	 */
	phoneVerification: boolean;
	/**
	 * @required
	 * @default false
	 */
	mfa: boolean;
	/**
	 * @array
	 * @optional
	 */
	mfaRecoveryCodes?: string[];
	/** @optional */
	search?: string;
	/** @optional */
	accessedAt?: string | Date;
}

export interface Sessions extends IEntity {
	/** @required */
	userId: string;
	/** @optional */
	provider?: string;
	/** @optional */
	providerUid?: string;
	/** @optional */
	providerAccessToken?: string;
	/** @optional */
	providerAccessTokenExpiry?: string | Date;
	/** @optional */
	providerRefreshToken?: string;
	/** @required */
	secretHash: string;
	/** @optional */
	userAgent?: string;
	/** @optional */
	ip?: string;
	/** @optional */
	countryCode?: string;
	/** @optional */
	osCode?: string;
	/** @optional */
	osName?: string;
	/** @optional */
	osVersion?: string;
	/** @optional */
	clientType?: string;
	/** @optional */
	clientCode?: string;
	/** @optional */
	clientName?: string;
	/** @optional */
	clientVersion?: string;
	/** @optional */
	clientEngine?: string;
	/** @optional */
	clientEngineVersion?: string;
	/** @optional */
	deviceName?: string;
	/** @optional */
	deviceBrand?: string;
	/** @optional */
	deviceModel?: string;
	/**
	 * @array
	 * @optional
	 */
	factors?: string[];
	/** @required */
	expire: string | Date;
	/** @optional */
	mfaUpdatedAt?: string | Date;
}

export interface Tokens extends IEntity {
	/** @required */
	userId: string;
	/** @required */
	type: number;
	/** @required */
	secretHash: string;
	/** @optional */
	expire?: string | Date;
	/** @optional */
	userAgent?: string;
	/** @optional */
	ip?: string;
}

export interface Authenticators extends IEntity {
	/** @required */
	userId: string;
	/** @required */
	type: string;
	/**
	 * @required
	 * @default false
	 */
	verified: boolean;
	/** @optional */
	data?: string;
}

export interface Challenges extends IEntity {
	/** @required */
	userId: string;
	/** @required */
	type: string;
	/** @optional */
	token?: string;
	/** @optional */
	code?: string;
	/** @required */
	expire: string | Date;
}

export interface Identities extends IEntity {
	/** @required */
	userId: string;
	/** @required */
	provider: string;
	/** @required */
	providerUid: string;
	/** @optional */
	providerEmail?: string;
	/** @optional */
	providerAccessToken?: string;
	/** @optional */
	providerAccessTokenExpiry?: string | Date;
	/** @optional */
	providerRefreshToken?: string;
}

export interface Targets extends IEntity {
	/** @required */
	userId: string;
	/** @required */
	providerType: string;
	/** @optional */
	providerId?: string;
	/** @required */
	identifier: string;
	/** @optional */
	name?: string;
	/**
	 * @required
	 * @default false
	 */
	expired: boolean;
}

export interface Teams extends IEntity {
	/** @required */
	name: string;
	/**
	 * @required
	 * @default 0
	 */
	total: number;
	/** @optional */
	search?: string;
	/**
	 * @optional
	 * @default {}
	 */
	prefs?: Record<string, any>;
}

export interface Memberships extends IEntity {
	/** @required */
	userId: string;
	/** @required */
	teamId: string;
	/**
	 * @array
	 * @optional
	 */
	roles?: string[];
	/** @optional */
	invited?: string | Date;
	/** @optional */
	joined?: string | Date;
	/**
	 * @required
	 * @default false
	 */
	confirm: boolean;
	/** @optional */
	secretHash?: string;
	/** @optional */
	search?: string;
}

// Document Types
export type UsersDoc = Doc<Users>;
export type SessionsDoc = Doc<Sessions>;
export type TokensDoc = Doc<Tokens>;
export type AuthenticatorsDoc = Doc<Authenticators>;
export type ChallengesDoc = Doc<Challenges>;
export type IdentitiesDoc = Doc<Identities>;
export type TargetsDoc = Doc<Targets>;
export type TeamsDoc = Doc<Teams>;
export type MembershipsDoc = Doc<Memberships>;

// Utility Types

// Utility types for Users
export type UsersCreate = Omit<
	Users,
	"$id" | "$createdAt" | "$updatedAt" | "$sequence"
>;
export type UsersUpdate = Partial<UsersCreate>;
export type UsersKeys = keyof Users;
export type UsersValues = Users[UsersKeys];
export type UsersPick<K extends keyof Users> = Pick<Users, K>;
export type UsersOmit<K extends keyof Users> = Omit<Users, K>;

// Utility types for Sessions
export type SessionsCreate = Omit<
	Sessions,
	"$id" | "$createdAt" | "$updatedAt" | "$sequence"
>;
export type SessionsUpdate = Partial<SessionsCreate>;
export type SessionsKeys = keyof Sessions;
export type SessionsValues = Sessions[SessionsKeys];
export type SessionsPick<K extends keyof Sessions> = Pick<Sessions, K>;
export type SessionsOmit<K extends keyof Sessions> = Omit<Sessions, K>;

// Utility types for Tokens
export type TokensCreate = Omit<
	Tokens,
	"$id" | "$createdAt" | "$updatedAt" | "$sequence"
>;
export type TokensUpdate = Partial<TokensCreate>;
export type TokensKeys = keyof Tokens;
export type TokensValues = Tokens[TokensKeys];
export type TokensPick<K extends keyof Tokens> = Pick<Tokens, K>;
export type TokensOmit<K extends keyof Tokens> = Omit<Tokens, K>;

// Utility types for Authenticators
export type AuthenticatorsCreate = Omit<
	Authenticators,
	"$id" | "$createdAt" | "$updatedAt" | "$sequence"
>;
export type AuthenticatorsUpdate = Partial<AuthenticatorsCreate>;
export type AuthenticatorsKeys = keyof Authenticators;
export type AuthenticatorsValues = Authenticators[AuthenticatorsKeys];
export type AuthenticatorsPick<K extends keyof Authenticators> = Pick<
	Authenticators,
	K
>;
export type AuthenticatorsOmit<K extends keyof Authenticators> = Omit<
	Authenticators,
	K
>;

// Utility types for Challenges
export type ChallengesCreate = Omit<
	Challenges,
	"$id" | "$createdAt" | "$updatedAt" | "$sequence"
>;
export type ChallengesUpdate = Partial<ChallengesCreate>;
export type ChallengesKeys = keyof Challenges;
export type ChallengesValues = Challenges[ChallengesKeys];
export type ChallengesPick<K extends keyof Challenges> = Pick<Challenges, K>;
export type ChallengesOmit<K extends keyof Challenges> = Omit<Challenges, K>;

// Utility types for Identities
export type IdentitiesCreate = Omit<
	Identities,
	"$id" | "$createdAt" | "$updatedAt" | "$sequence"
>;
export type IdentitiesUpdate = Partial<IdentitiesCreate>;
export type IdentitiesKeys = keyof Identities;
export type IdentitiesValues = Identities[IdentitiesKeys];
export type IdentitiesPick<K extends keyof Identities> = Pick<Identities, K>;
export type IdentitiesOmit<K extends keyof Identities> = Omit<Identities, K>;

// Utility types for Targets
export type TargetsCreate = Omit<
	Targets,
	"$id" | "$createdAt" | "$updatedAt" | "$sequence"
>;
export type TargetsUpdate = Partial<TargetsCreate>;
export type TargetsKeys = keyof Targets;
export type TargetsValues = Targets[TargetsKeys];
export type TargetsPick<K extends keyof Targets> = Pick<Targets, K>;
export type TargetsOmit<K extends keyof Targets> = Omit<Targets, K>;

// Utility types for Teams
export type TeamsCreate = Omit<
	Teams,
	"$id" | "$createdAt" | "$updatedAt" | "$sequence"
>;
export type TeamsUpdate = Partial<TeamsCreate>;
export type TeamsKeys = keyof Teams;
export type TeamsValues = Teams[TeamsKeys];
export type TeamsPick<K extends keyof Teams> = Pick<Teams, K>;
export type TeamsOmit<K extends keyof Teams> = Omit<Teams, K>;

// Utility types for Memberships
export type MembershipsCreate = Omit<
	Memberships,
	"$id" | "$createdAt" | "$updatedAt" | "$sequence"
>;
export type MembershipsUpdate = Partial<MembershipsCreate>;
export type MembershipsKeys = keyof Memberships;
export type MembershipsValues = Memberships[MembershipsKeys];
export type MembershipsPick<K extends keyof Memberships> = Pick<Memberships, K>;
export type MembershipsOmit<K extends keyof Memberships> = Omit<Memberships, K>;

// Input Types

// Input types for Users
export type UsersInput = Omit<
	Users,
	| "$id"
	| "$createdAt"
	| "$updatedAt"
	| "$permissions"
	| "$sequence"
	| "$collection"
	| "$tenant"
>;
export type UsersCreateInput = UsersInput;
export type UsersUpdateInput = Partial<UsersInput>;

// Input types for Sessions
export type SessionsInput = Omit<
	Sessions,
	| "$id"
	| "$createdAt"
	| "$updatedAt"
	| "$permissions"
	| "$sequence"
	| "$collection"
	| "$tenant"
>;
export type SessionsCreateInput = SessionsInput;
export type SessionsUpdateInput = Partial<SessionsInput>;

// Input types for Tokens
export type TokensInput = Omit<
	Tokens,
	| "$id"
	| "$createdAt"
	| "$updatedAt"
	| "$permissions"
	| "$sequence"
	| "$collection"
	| "$tenant"
>;
export type TokensCreateInput = TokensInput;
export type TokensUpdateInput = Partial<TokensInput>;

// Input types for Authenticators
export type AuthenticatorsInput = Omit<
	Authenticators,
	| "$id"
	| "$createdAt"
	| "$updatedAt"
	| "$permissions"
	| "$sequence"
	| "$collection"
	| "$tenant"
>;
export type AuthenticatorsCreateInput = AuthenticatorsInput;
export type AuthenticatorsUpdateInput = Partial<AuthenticatorsInput>;

// Input types for Challenges
export type ChallengesInput = Omit<
	Challenges,
	| "$id"
	| "$createdAt"
	| "$updatedAt"
	| "$permissions"
	| "$sequence"
	| "$collection"
	| "$tenant"
>;
export type ChallengesCreateInput = ChallengesInput;
export type ChallengesUpdateInput = Partial<ChallengesInput>;

// Input types for Identities
export type IdentitiesInput = Omit<
	Identities,
	| "$id"
	| "$createdAt"
	| "$updatedAt"
	| "$permissions"
	| "$sequence"
	| "$collection"
	| "$tenant"
>;
export type IdentitiesCreateInput = IdentitiesInput;
export type IdentitiesUpdateInput = Partial<IdentitiesInput>;

// Input types for Targets
export type TargetsInput = Omit<
	Targets,
	| "$id"
	| "$createdAt"
	| "$updatedAt"
	| "$permissions"
	| "$sequence"
	| "$collection"
	| "$tenant"
>;
export type TargetsCreateInput = TargetsInput;
export type TargetsUpdateInput = Partial<TargetsInput>;

// Input types for Teams
export type TeamsInput = Omit<
	Teams,
	| "$id"
	| "$createdAt"
	| "$updatedAt"
	| "$permissions"
	| "$sequence"
	| "$collection"
	| "$tenant"
>;
export type TeamsCreateInput = TeamsInput;
export type TeamsUpdateInput = Partial<TeamsInput>;

// Input types for Memberships
export type MembershipsInput = Omit<
	Memberships,
	| "$id"
	| "$createdAt"
	| "$updatedAt"
	| "$permissions"
	| "$sequence"
	| "$collection"
	| "$tenant"
>;
export type MembershipsCreateInput = MembershipsInput;
export type MembershipsUpdateInput = Partial<MembershipsInput>;

export interface Entities {
	users: Users;
	sessions: Sessions;
	tokens: Tokens;
	authenticators: Authenticators;
	challenges: Challenges;
	identities: Identities;
	targets: Targets;
	teams: Teams;
	memberships: Memberships;
}

type GeneratedEntitiesRegistry = Entities;

/**
 * Opt-in integration: including or importing this generated file augments
 * the package registry. Session APIs then infer collection IDs, documents,
 * and query attributes while their arbitrary-string fallback remains intact.
 */
declare module "@nuvix/db" {
	interface Entities extends GeneratedEntitiesRegistry {}
}
