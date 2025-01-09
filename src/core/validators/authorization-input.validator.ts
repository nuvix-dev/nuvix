
export class Input {
    protected permissions: string[];
    protected action: string;

    /**
     * @param action - The action associated with the permissions
     * @param permissions - The permissions for the action
     */
    constructor(action: string, permissions: string[]) {
        this.permissions = permissions;
        this.action = action;
    }

    /**
     * Set Permissions.
     *
     * @param permissions - The permissions to set
     * @returns {this}
     */
    public setPermissions(permissions: string[]): this {
        this.permissions = permissions;
        return this;
    }

    /**
     * Set Action.
     *
     * @param action - The action to set
     * @returns {this}
     */
    public setAction(action: string): this {
        this.action = action;
        return this;
    }

    /**
     * Get Permissions.
     *
     * @returns {string[]} - The permissions
     */
    public getPermissions(): string[] {
        return this.permissions;
    }

    /**
     * Get Action.
     *
     * @returns {string} - The action
     */
    public getAction(): string {
        return this.action;
    }
}
