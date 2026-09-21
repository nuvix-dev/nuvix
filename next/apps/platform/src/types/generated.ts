// This file is auto-generated. Do not edit manually.
// Generated on: 2026-09-20T04:18:16.814Z

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

export interface Projects extends IEntity {
	/** @required */
	name: string;
	/**
	 * @required
	 * @default "provisioning"
	 */
	status: string;
	/** @required */
	publishableKey: string;
	/** @required */
	containerName: string;
	/** @required */
	volumeName: string;
	/** @optional */
	target?: string;
	/** @optional */
	errorMessage?: string;
}

// Document Types
export type ProjectsDoc = Doc<Projects>;

// Utility Types

// Utility types for Projects
export type ProjectsCreate = Omit<
	Projects,
	"$id" | "$createdAt" | "$updatedAt" | "$sequence"
>;
export type ProjectsUpdate = Partial<ProjectsCreate>;
export type ProjectsKeys = keyof Projects;
export type ProjectsValues = Projects[ProjectsKeys];
export type ProjectsPick<K extends keyof Projects> = Pick<Projects, K>;
export type ProjectsOmit<K extends keyof Projects> = Omit<Projects, K>;

// Input Types

// Input types for Projects
export type ProjectsInput = Omit<
	Projects,
	| "$id"
	| "$createdAt"
	| "$updatedAt"
	| "$permissions"
	| "$sequence"
	| "$collection"
	| "$tenant"
>;
export type ProjectsCreateInput = ProjectsInput;
export type ProjectsUpdateInput = Partial<ProjectsInput>;

export interface Entities {
	projects: Projects;
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
