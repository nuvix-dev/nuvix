import { Input } from './authorization-input.validator';

export class Authorization {
  protected status: boolean = true;
  protected statusDefault: boolean = true;
  private roles: { [key: string]: boolean } = { 'any': true };
  protected message: string = 'Authorization Error';

  public getDescription(): string {
    return this.message;
  }

  public isValid(input: Input | any): boolean { // any, CREATE
    if (!(input instanceof Input)) {
      this.message = 'Invalid input provided';
      return false;
    }

    const permissions = input.getPermissions();
    const action = input.getAction();

    if (!this.status) {
      return true;
    }

    if (!permissions || permissions.length === 0) {
      this.message = `No permissions provided for action '${action}'`;
      return false;
    }

    let permission = '-';

    for (permission of permissions) {
      console.log(`${permission}: ${this.roles.hasOwnProperty(permission)}`)
      if (this.roles.hasOwnProperty(permission)) {
        return true;
      }
    }

    this.message = `Missing "${action}" permission for role "${permission}". Only "${JSON.stringify(this.getRoles())}" scopes are allowed and "${JSON.stringify(permissions)}" was given.`;
    return false;
  }

  public addRole(role: string): void {
    this.roles[role] = true;
  }

  public removeRole(role: string): void {
    delete this.roles[role];
  }

  public getRoles(): string[] {
    return Object.keys(this.roles);
  }

  public cleanRoles(): void {
    this.roles = {};
  }

  public isRole(role: string): boolean {
    return this.roles.hasOwnProperty(role);
  }

  public setDefaultStatus(status: boolean): void {
    this.statusDefault = status;
    this.status = status;
  }

  public setStatus(status: boolean): void {
    this.status = status;
  }

  public getStatus(): boolean {
    return this.status;
  }

  public getStatusDefault(): boolean {
    return this.statusDefault;
  }

  public skip<T>(callback: () => T): T {
    const initialStatus = this.status;
    this.disable();

    try {
      return callback();
    } finally {
      this.status = initialStatus;
    }
  }

  public enable(): void {
    this.status = true;
  }

  public disable(): void {
    this.status = false;
  }

  public reset(): void {
    this.status = this.statusDefault;
  }

  public isArray(): boolean {
    return false;
  }

  public getType(): string {
    return 'array'; // Adjust according to your needs
  }
}
