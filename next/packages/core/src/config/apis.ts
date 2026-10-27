/** Identifiers for the API surfaces a server exposes. */
export interface ApiItem {
  key: string
  name: string
}

/** Registry of API surfaces, keyed by url segment. */
export const apis: Record<string, ApiItem> = {
  rest: {
    key: 'rest',
    name: 'REST',
  },
} as const
