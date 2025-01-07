import { RoleType } from "../helper/role.helper";

interface RoleConfig {
  identifier: {
    allowed: boolean;
    required: boolean;
  };
  dimension: {
    allowed: boolean;
    required: boolean;
    options?: string[];
  };
}

export default class Roles {
  protected readonly allowed: RoleType[];
  protected readonly length: number;
  protected message: string = 'Roles Error';

  static readonly DIMENSION_VERIFIED = 'verified';
  static readonly DIMENSION_UNVERIFIED = 'unverified';
  private static readonly USER_DIMENSIONS = [Roles.DIMENSION_VERIFIED, Roles.DIMENSION_UNVERIFIED];

  private static readonly ROLE_CONFIG: Record<RoleType, RoleConfig> = {
    [RoleType.ANY]: {
      identifier: { allowed: false, required: false },
      dimension: { allowed: false, required: false },
    },
    [RoleType.GUESTS]: {
      identifier: { allowed: false, required: false },
      dimension: { allowed: false, required: false },
    },
    [RoleType.USERS]: {
      identifier: { allowed: false, required: false },
      dimension: { allowed: true, required: false, options: Roles.USER_DIMENSIONS },
    },
    [RoleType.USER]: {
      identifier: { allowed: true, required: true },
      dimension: { allowed: true, required: false, options: Roles.USER_DIMENSIONS },
    },
    [RoleType.TEAM]: {
      identifier: { allowed: true, required: true },
      dimension: { allowed: true, required: false },
    },
    [RoleType.MEMBER]: {
      identifier: { allowed: true, required: true },
      dimension: { allowed: false, required: false },
    },
    [RoleType.LABEL]: {
      identifier: { allowed: true, required: true },
      dimension: { allowed: false, required: false },
    },
  };

  constructor(length: number = 0, allowed: RoleType[] = Object.values(RoleType)) {
    this.length = length;
    this.allowed = allowed;
  }

  public getDescription(): string {
    return this.message;
  }

  public isValid(roles: string[]): boolean {
    if (!Array.isArray(roles)) {
      this.message = 'Roles must be an array of strings.';
      return false;
    }

    if (this.length && roles.length > this.length) {
      this.message = `You can only provide up to ${this.length} roles.`;
      return false;
    }

    for (const role of roles) {
      if (typeof role !== 'string') {
        this.message = 'Every role must be of type string.';
        return false;
      }

      // if (role === '*') {
      //   this.message = 'Wildcard role "*" has been replaced. Use "any" instead.';
      //   return false;
      // }

      // if (role.startsWith('role:')) {
      //   this.message = 'Roles using the "role:" prefix have been removed. Use "users", "guests", or "any" instead.';
      //   return false;
      // }

      if (!this.allowed.includes(role as RoleType)) {
        this.message = `Role "${role}" is not allowed. Must be one of: ${this.allowed.join(', ')}.`;
        return false;
      }

      const roleParts = role.split(':');
      const roleType = roleParts[0] as RoleType;
      const identifier = roleParts[1] || undefined;
      const dimension = roleParts[2] || undefined;

      if (!this.isValidRole(roleType, identifier, dimension)) {
        return false;
      }
    }

    return true;
  }

  private isValidRole(role: RoleType, identifier?: string, dimension?: string): boolean {
    const config = Roles.ROLE_CONFIG[role];

    if (!config) {
      this.message = `Role "${role}" is not allowed. Must be one of: ${Object.values(RoleType).join(', ')}.`;
      return false;
    }

    // Identifier validation
    if (!config.identifier.allowed && identifier) {
      this.message = `Role "${role}" can not have an ID value.`;
      return false;
    }

    if (config.identifier.allowed && config.identifier.required && !identifier) {
      this.message = `Role "${role}" must have an ID value.`;
      return false;
    }

    // Dimension validation
    if (!config.dimension.allowed && dimension) {
      this.message = `Role "${role}" can not have a dimension value.`;
      return false;
    }

    if (config.dimension.allowed && config.dimension.required && !dimension) {
      this.message = `Role "${role}" must have a dimension value.`;
      return false;
    }

    if (config.dimension.allowed && dimension && !config.dimension.options?.includes(dimension)) {
      this.message = `Role "${role}" dimension value is invalid. Must be one of: ${config.dimension.options?.join(', ') || 'none'}.`;
      return false;
    }

    return true;
  }
}