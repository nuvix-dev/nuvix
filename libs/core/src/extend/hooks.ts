export class Hooks {
  private static hooks: Record<string, (...args: any[]) => any> = {}

  public static add(name: string, action: (...args: any[]) => any): void {
    Hooks.hooks[name] = action
  }

  public static trigger(name: string, params: any[] = []): any | Promise<any> {
    if (Hooks.hooks[name]) {
      return Hooks.hooks[name](...params)
    }

    return null
  }
}
