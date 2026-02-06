import type { Validator } from '@nuvix/db'

export class Hostname implements Validator {
  private allowList: string[] = []

  /**
   * Constructor
   *
   * Sets allowed hostname patterns
   */
  constructor(allowList: string[] = []) {
    this.allowList = allowList
  }

  /**
   * Get description of the validator
   */
  $description =
    'Value must be a valid hostname without path, port and protocol.'

  /**
   * Validate if the value is a valid hostname
   */
  $valid(value: any): boolean {
    // Validate proper format
    if (typeof value !== 'string' || !value) {
      return false
    }

    // Max length 253 chars: https://en.wikipedia.org/wiki/Hostname#:~:text=The%20entire%20hostname%2C%20including%20the,maximum%20of%20253%20ASCII%20characters
    if (value.length > 253) {
      return false
    }

    // This tests: 'http://', 'https://', and 'myapp.com/route'
    if (value.includes('/')) {
      return false
    }

    // This tests for: 'myapp.com:3000'
    if (value.includes(':')) {
      return false
    }

    // Logic #1: Empty allowList means everything is allowed
    if (this.allowList.length === 0) {
      return true
    }

    // Logic #2: Allow List not empty, there are rules to check
    // Loop through all allowed hostnames until match is found
    for (const allowedHostname of this.allowList) {
      // If exact match; allow
      // If *, allow everything
      if (value === allowedHostname || allowedHostname === '*') {
        return true
      }

      // If wildcard symbol used
      if (allowedHostname.startsWith('*')) {
        // Remove starting * symbol before comparing
        const pattern = allowedHostname.substring(1)

        // If rest of hostname match; allow
        // Notice allowedHostname still includes starting dot. Root domain is NOT allowed by wildcard.
        if (value.endsWith(pattern)) {
          return true
        }
      }
    }

    // If finished loop above without result, match is not found
    return false
  }
}
