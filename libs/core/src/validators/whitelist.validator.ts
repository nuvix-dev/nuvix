import { Validator } from '@nuvix-tech/db';

export class WhiteList implements Validator {
  private list: string[];
  private strict: boolean;

  constructor(list: string[], strict: boolean = false) {
    this.list = list;
    this.strict = strict;

    if (!this.strict) {
      this.list = this.list.map(value => value.toLowerCase());
    }
  }

  getList(): string[] {
    return this.list;
  }

  get $description(): string {
    return `Value must be one of (${this.list.join(', ')})`;
  }

  $valid(value: any): boolean {
    if (Array.isArray(value)) {
      return false;
    }

    value = this.strict ? value : value.toLowerCase();

    return this.list.includes(value);
  }
}
